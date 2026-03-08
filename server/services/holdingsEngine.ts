import { getDb } from '../db';
import { calcMovingAvgPrice, calcRealizedPnl } from '../utils/financeCalc';

// 매수로 처리할 거래 유형 (증권사별 명칭 포함 — 명시적 목록)
const BUY_TYPES = new Set([
  '매수',
  '주식매수입고', '주식매수', '매수입고',
  '신용매수', '신용매수입고',
  '대체입고', '계좌대체입고', '타사대체입고',  // 타 계좌/증권사 이전 입고
  'buy', 'BUY',
]);
// 매도로 처리할 거래 유형 (증권사별 명칭 포함 — 명시적 목록)
const SELL_TYPES = new Set([
  '매도',
  '주식매도출고', '주식매도', '매도출고',
  '신용매도', '신용매도출고',
  '대체출고', '계좌대체출고', '타사대체출고',  // 타 계좌/증권사 이전 출고
  'sell', 'SELL',
]);

const CANCEL_KEYWORDS = ['취소', '정정', '오류', '실패'];

/**
 * 거래 유형이 매수(주식 취득)인지 판별.
 * 명시적 목록 우선, 그 다음 패턴 매칭으로 폴백하여 증권사별 다양한 명칭에 대응.
 * '매수' 또는 '입고'를 포함하고, 취소/정정/오류가 없으면 매수로 간주.
 * '출금'·'입금'은 현금 이동으로 '입고'·'출고'와 구별됨.
 */
function isBuyTx(type: string): boolean {
  if (BUY_TYPES.has(type)) return true;
  const t = type.trim();
  if (CANCEL_KEYWORDS.some((k) => t.includes(k))) return false;
  return t.includes('매수') || t.includes('입고');
}

/**
 * 거래 유형이 매도(주식 처분)인지 판별.
 * '매도' 또는 '출고'를 포함하고, 취소/정정/오류가 없으면 매도로 간주.
 */
function isSellTx(type: string): boolean {
  if (SELL_TYPES.has(type)) return true;
  const t = type.trim();
  if (CANCEL_KEYWORDS.some((k) => t.includes(k))) return false;
  return t.includes('매도') || t.includes('출고');
}

interface TxRow {
  date: string;
  type: string;
  security: string;
  security_code: string;
  quantity: number;         // 수량 (0이면 미입력)
  unit_price: number;       // 단가 (0이면 미입력)
  amount: number;           // 거래금액 (KRW)
  foreign_amount: number;   // 외화 거래금액 (USD 등, 0이면 없음)
  foreign_currency: string; // 'USD' or ''
}

interface HoldingState {
  securityName: string;
  currency: string;         // 'KRW' | 'USD'
  quantity: number;
  avgBuyPrice: number;
  totalBuyAmount: number;
  avgBuyPriceUsd: number;   // USD 평균 매입단가 (USD 종목일 때만 유효)
  totalBuyUsd: number;      // USD 총 매입금액
  realizedPnl: number;
  realizedPnlUsd: number;   // USD 실현손익
}

const UPSERT_SQL = `
  INSERT INTO holdings
    (account_id, security_code, security_name, currency, quantity, avg_buy_price,
     total_buy_amount, avg_buy_price_usd, total_buy_usd, realized_pnl, realized_pnl_usd, last_updated)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  ON CONFLICT(account_id, security_code) DO UPDATE SET
    security_name     = excluded.security_name,
    currency          = excluded.currency,
    quantity          = excluded.quantity,
    avg_buy_price     = excluded.avg_buy_price,
    total_buy_amount  = excluded.total_buy_amount,
    avg_buy_price_usd = excluded.avg_buy_price_usd,
    total_buy_usd     = excluded.total_buy_usd,
    realized_pnl      = excluded.realized_pnl,
    realized_pnl_usd  = excluded.realized_pnl_usd,
    last_updated      = excluded.last_updated
`;

/** 거래 1건으로 보유 상태를 업데이트한다. */
function applyTransaction(h: HoldingState, tx: TxRow): void {
  if (tx.security) h.securityName = tx.security;
  // 외화 거래가 있으면 해당 통화로 설정 (USD 우선)
  if (tx.foreign_currency) h.currency = tx.foreign_currency;

  if (isBuyTx(tx.type)) {
    const qty = tx.quantity;
    // KRW 단가: unit_price 우선, 없으면 금액÷수량으로 추정
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
    // amount=0인 대체입고 등: qty×price로 매수원금 추정
    const buyAmount = Math.abs(tx.amount) > 0 ? Math.abs(tx.amount) : qty * price;
    h.totalBuyAmount += buyAmount;

    // USD 매입원가 추적
    if (tx.foreign_currency === 'USD' && tx.foreign_amount !== 0) {
      const usdAmt = Math.abs(tx.foreign_amount);
      const usdPrice = qty > 0 ? usdAmt / qty : 0;
      if (qty > 0 && usdPrice > 0) {
        h.avgBuyPriceUsd = calcMovingAvgPrice(h.quantity - qty, h.avgBuyPriceUsd, qty, usdPrice);
      }
      h.totalBuyUsd += usdAmt;
    }

  } else if (isSellTx(tx.type)) {
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
      // 매도된 비율만큼 총 매수원금 차감
      h.totalBuyAmount = Math.max(0, h.totalBuyAmount - h.avgBuyPrice * qty);
    }

    // USD 실현손익 추적
    if (tx.foreign_currency === 'USD' && tx.foreign_amount !== 0 && qty > 0) {
      const usdSellPrice = Math.abs(tx.foreign_amount) / qty;
      h.realizedPnlUsd += calcRealizedPnl(qty, usdSellPrice, h.avgBuyPriceUsd);
      h.totalBuyUsd = Math.max(0, h.totalBuyUsd - h.avgBuyPriceUsd * qty);
    }
  }
  // 배당/입금/출금/기타 → 변경 없음
}

/**
 * 특정 계좌의 모든 보유 종목을 재계산한다.
 * 거래 내역 대량 변경(import, bulk delete) 후 호출.
 */
export function recalculateHoldings(accountId: number): void {
  const db = getDb();

  const txRows = db.prepare(`
    SELECT date, type, security, security_code,
           COALESCE(quantity, 0)         AS quantity,
           COALESCE(unit_price, 0)       AS unit_price,
           amount,
           COALESCE(foreign_amount, 0)   AS foreign_amount,
           COALESCE(foreign_currency,'') AS foreign_currency
    FROM securities_transactions
    WHERE account_id = ?
    ORDER BY date ASC, id ASC
  `).all(accountId) as unknown as TxRow[];

  // security_code별 상태 누적
  const holdingMap = new Map<string, HoldingState>();
  for (const tx of txRows) {
    const code = tx.security_code?.trim();
    if (!code) continue;
    if (!holdingMap.has(code)) {
      holdingMap.set(code, {
        securityName: tx.security ?? '',
        currency: 'KRW',
        quantity: 0,
        avgBuyPrice: 0,
        totalBuyAmount: 0,
        avgBuyPriceUsd: 0,
        totalBuyUsd: 0,
        realizedPnl: 0,
        realizedPnlUsd: 0,
      });
    }
    applyTransaction(holdingMap.get(code)!, tx);
  }

  // 현재 holdings에서 거래가 없어진 종목 삭제
  const existingCodes = (
    db.prepare('SELECT security_code FROM holdings WHERE account_id = ?').all(accountId) as {
      security_code: string;
    }[]
  ).map((r) => r.security_code);

  const activeCodes = new Set([...holdingMap.keys()]);
  const upsertStmt = db.prepare(UPSERT_SQL);

  db.exec('BEGIN');
  try {
    // 거래가 전부 삭제된 종목 → holdings도 삭제
    for (const code of existingCodes) {
      if (!activeCodes.has(code)) {
        db.prepare('DELETE FROM holdings WHERE account_id = ? AND security_code = ?').run(
          accountId,
          code
        );
      }
    }
    // 활성 종목 upsert
    for (const [code, h] of holdingMap) {
      upsertStmt.run(
        accountId, code, h.securityName, h.currency,
        h.quantity, h.avgBuyPrice, h.totalBuyAmount,
        h.avgBuyPriceUsd, h.totalBuyUsd,
        h.realizedPnl, h.realizedPnlUsd
      );
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/**
 * 특정 종목만 재계산한다.
 * 단건 거래 추가/수정/삭제 시 성능 최적화를 위해 사용.
 */
export function recalculateHoldingForSecurity(
  accountId: number,
  securityCode: string
): void {
  if (!securityCode?.trim()) {
    recalculateHoldings(accountId);
    return;
  }

  const db = getDb();

  const txRows = db.prepare(`
    SELECT date, type, security, security_code,
           COALESCE(quantity, 0)         AS quantity,
           COALESCE(unit_price, 0)       AS unit_price,
           amount,
           COALESCE(foreign_amount, 0)   AS foreign_amount,
           COALESCE(foreign_currency,'') AS foreign_currency
    FROM securities_transactions
    WHERE account_id = ? AND security_code = ?
    ORDER BY date ASC, id ASC
  `).all(accountId, securityCode) as unknown as TxRow[];

  // 해당 종목 거래가 모두 삭제된 경우
  if (txRows.length === 0) {
    db.prepare('DELETE FROM holdings WHERE account_id = ? AND security_code = ?').run(
      accountId,
      securityCode
    );
    return;
  }

  const h: HoldingState = {
    securityName: '',
    currency: 'KRW',
    quantity: 0,
    avgBuyPrice: 0,
    totalBuyAmount: 0,
    avgBuyPriceUsd: 0,
    totalBuyUsd: 0,
    realizedPnl: 0,
    realizedPnlUsd: 0,
  };
  for (const tx of txRows) applyTransaction(h, tx);

  db.prepare(UPSERT_SQL).run(
    accountId, securityCode, h.securityName, h.currency,
    h.quantity, h.avgBuyPrice, h.totalBuyAmount,
    h.avgBuyPriceUsd, h.totalBuyUsd,
    h.realizedPnl, h.realizedPnlUsd
  );
}
