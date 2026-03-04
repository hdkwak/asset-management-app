import { getDb } from '../db';
import { calcMovingAvgPrice, calcRealizedPnl } from '../utils/financeCalc';

// Copied from holdingsEngine to avoid circular imports
const BUY_TYPES = new Set([
  '매수',
  '주식매수입고', '주식매수', '매수입고',
  '신용매수', '신용매수입고',
  'buy', 'BUY',
]);
const SELL_TYPES = new Set([
  '매도',
  '주식매도출고', '주식매도', '매도출고',
  '신용매도', '신용매도출고',
  'sell', 'SELL',
]);

export interface HistoryPoint {
  date: string;
  eval_amount: number;
  buy_amount: number;
}

interface TxRow {
  account_id: number;
  date: string;
  type: string;
  security: string;
  security_code: string;
  quantity: number;
  unit_price: number;
  amount: number;
  balance: number;
}

interface HoldingState {
  securityName: string;
  securityCode: string;
  quantity: number;
  avgBuyPrice: number;
  totalBuyAmount: number;
  realizedPnl: number;
}

function applyTransaction(h: HoldingState, tx: TxRow): void {
  if (tx.security) h.securityName = tx.security;

  if (BUY_TYPES.has(tx.type)) {
    const qty = tx.quantity;
    const price =
      tx.unit_price > 0
        ? tx.unit_price
        : qty > 0
        ? Math.abs(tx.amount) / qty
        : 0;
    if (qty > 0 && price > 0) {
      h.avgBuyPrice = calcMovingAvgPrice(h.quantity, h.avgBuyPrice, qty, price);
      h.quantity += qty;
    }
    h.totalBuyAmount += Math.abs(tx.amount);
  } else if (SELL_TYPES.has(tx.type)) {
    const qty = tx.quantity;
    const price =
      tx.unit_price > 0
        ? tx.unit_price
        : qty > 0
        ? Math.abs(tx.amount) / qty
        : 0;
    if (qty > 0 && price > 0) {
      h.realizedPnl += calcRealizedPnl(qty, price, h.avgBuyPrice);
      h.quantity = Math.max(0, h.quantity - qty);
      h.totalBuyAmount = Math.max(0, h.totalBuyAmount - h.avgBuyPrice * qty);
    }
  }
}

function computeSnapshot(
  date: string,
  holdingMap: Map<string, HoldingState>,
  priceMap: Map<string, number>,
  tickerMap: Map<string, string>,
  cashTotal: number,
): HistoryPoint {
  let evalAmount = cashTotal; // 예수금 포함
  let buyAmount = 0;
  for (const [key, h] of holdingMap) {
    if (h.quantity > 0) {
      const ticker = tickerMap.get(key);
      const lookupCode = ticker ?? h.securityCode;
      const price = priceMap.get(lookupCode) ?? h.avgBuyPrice;
      evalAmount += h.quantity * price;
    }
    buyAmount += h.totalBuyAmount;
  }
  return { date, eval_amount: evalAmount, buy_amount: buyAmount };
}

/**
 * 포트폴리오 히스토리를 재계산한다.
 * 각 거래 날짜 기준으로 평가금액(현재가 기준)과 누적 매수원금을 반환한다.
 */
export function buildPortfolioHistory(accountId: number | null): HistoryPoint[] {
  const db = getDb();

  // Load price cache as Map<security_code, current_price>
  const priceRows = db
    .prepare('SELECT security_code, current_price FROM price_cache')
    .all() as { security_code: string; current_price: number }[];
  const priceMap = new Map<string, number>(
    priceRows.map((r) => [r.security_code, r.current_price]),
  );

  // Load ticker_code mapping keyed by "accountId-securityCode"
  const tickerQuery = accountId
    ? "SELECT account_id, security_code, ticker_code FROM holdings WHERE account_id = ? AND ticker_code IS NOT NULL AND ticker_code != ''"
    : "SELECT account_id, security_code, ticker_code FROM holdings WHERE ticker_code IS NOT NULL AND ticker_code != ''";
  const tickerRows = accountId
    ? (db.prepare(tickerQuery).all(accountId) as { account_id: number; security_code: string; ticker_code: string }[])
    : (db.prepare(tickerQuery).all() as { account_id: number; security_code: string; ticker_code: string }[]);
  const tickerMap = new Map<string, string>(
    tickerRows.map((r) => [`${r.account_id}-${r.security_code}`, r.ticker_code]),
  );

  // Fetch all relevant transactions ordered by date
  const txSql = `
    SELECT account_id, date, type, security, security_code,
           COALESCE(quantity, 0)   AS quantity,
           COALESCE(unit_price, 0) AS unit_price,
           amount,
           COALESCE(balance, 0)    AS balance
    FROM securities_transactions
    ${accountId ? 'WHERE account_id = ?' : ''}
    ORDER BY date ASC, id ASC
  `;
  const txRows = (
    accountId
      ? db.prepare(txSql).all(accountId)
      : db.prepare(txSql).all()
  ) as unknown as TxRow[];

  if (txRows.length === 0) return [];

  const holdingMap = new Map<string, HoldingState>();
  // 계좌별 예수금 잔고 (balance > 0 인 거래의 최신 balance 값)
  const cashMap = new Map<number, number>();
  const result: HistoryPoint[] = [];
  let currentDate = '';

  const getCashTotal = () => [...cashMap.values()].reduce((s, v) => s + v, 0);

  for (const tx of txRows) {
    if (tx.date !== currentDate) {
      if (currentDate) {
        result.push(computeSnapshot(currentDate, holdingMap, priceMap, tickerMap, getCashTotal()));
      }
      currentDate = tx.date;
    }

    // 예수금 잔고 업데이트 (balance 가 있는 거래만)
    if (tx.balance > 0) {
      cashMap.set(tx.account_id, tx.balance);
    }

    const code = tx.security_code?.trim();
    if (!code) continue;

    const key = `${tx.account_id}-${code}`;
    if (!holdingMap.has(key)) {
      holdingMap.set(key, {
        securityName: tx.security ?? '',
        securityCode: code,
        quantity: 0,
        avgBuyPrice: 0,
        totalBuyAmount: 0,
        realizedPnl: 0,
      });
    }
    applyTransaction(holdingMap.get(key)!, tx);
  }

  if (currentDate) {
    result.push(computeSnapshot(currentDate, holdingMap, priceMap, tickerMap, getCashTotal()));
  }

  return result;
}
