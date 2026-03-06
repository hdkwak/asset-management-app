import { getDb } from '../db';
import { calcMovingAvgPrice, calcRealizedPnl } from '../utils/financeCalc';

// Copied from holdingsEngine to avoid circular imports
const BUY_TYPES = new Set([
  '매수',
  '주식매수입고', '주식매수', '매수입고',
  '신용매수', '신용매수입고',
  '대체입고', '계좌대체입고', '타사대체입고',
  'buy', 'BUY',
]);
const SELL_TYPES = new Set([
  '매도',
  '주식매도출고', '주식매도', '매도출고',
  '신용매도', '신용매도출고',
  '대체출고', '계좌대체출고', '타사대체출고',
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
    const buyAmount = Math.abs(tx.amount) > 0 ? Math.abs(tx.amount) : qty * price;
    h.totalBuyAmount += buyAmount;
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
  cashTotal: number,
): HistoryPoint {
  // 과거 스냅샷은 현재가 대신 취득원가(avg_buy_price) 사용
  // → 매도 시 실현손익만 반영, 현재가 역산에 의한 가상 급락 방지
  let evalAmount = cashTotal;
  let buyAmount = 0;
  for (const [, h] of holdingMap) {
    if (h.quantity > 0) {
      evalAmount += h.quantity * h.avgBuyPrice;
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
        result.push(computeSnapshot(currentDate, holdingMap, getCashTotal()));
      }
      currentDate = tx.date;
    }

    // 예수금 잔고 업데이트
    if (tx.balance > 0) {
      // balance 컬럼이 있으면 절대값으로 우선 사용
      cashMap.set(tx.account_id, tx.balance);
    } else {
      // balance 미기록 시 매수/매도 금액으로 상대적 현금 추정
      const cur = cashMap.get(tx.account_id) ?? 0;
      if (SELL_TYPES.has(tx.type)) {
        cashMap.set(tx.account_id, cur + Math.abs(tx.amount)); // 매도 → 현금 증가
      } else if (BUY_TYPES.has(tx.type)) {
        cashMap.set(tx.account_id, Math.max(0, cur - Math.abs(tx.amount))); // 매수 → 현금 감소
      }
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
    result.push(computeSnapshot(currentDate, holdingMap, getCashTotal()));
  }

  return result;
}
