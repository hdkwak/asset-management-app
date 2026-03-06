import { getDb } from '../db';
import { calcMovingAvgPrice, calcRealizedPnl } from '../utils/financeCalc';

// 매수로 처리할 거래 유형 (증권사별 명칭 포함)
const BUY_TYPES = new Set([
  '매수',
  '주식매수입고', '주식매수', '매수입고',
  '신용매수', '신용매수입고',
  '대체입고', '계좌대체입고', '타사대체입고',  // 타 계좌/증권사 이전 입고
  'buy', 'BUY',
]);
// 매도로 처리할 거래 유형 (증권사별 명칭 포함)
const SELL_TYPES = new Set([
  '매도',
  '주식매도출고', '주식매도', '매도출고',
  '신용매도', '신용매도출고',
  '대체출고', '계좌대체출고', '타사대체출고',  // 타 계좌/증권사 이전 출고
  'sell', 'SELL',
]);

interface TxRow {
  date: string;
  type: string;
  security: string;
  security_code: string;
  quantity: number;    // 수량 (0이면 미입력)
  unit_price: number;  // 단가 (0이면 미입력)
  amount: number;      // 거래금액
}

interface HoldingState {
  securityName: string;
  quantity: number;
  avgBuyPrice: number;
  totalBuyAmount: number;
  realizedPnl: number;
}

const UPSERT_SQL = `
  INSERT INTO holdings
    (account_id, security_code, security_name, quantity, avg_buy_price,
     total_buy_amount, realized_pnl, last_updated)
  VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  ON CONFLICT(account_id, security_code) DO UPDATE SET
    security_name    = excluded.security_name,
    quantity         = excluded.quantity,
    avg_buy_price    = excluded.avg_buy_price,
    total_buy_amount = excluded.total_buy_amount,
    realized_pnl     = excluded.realized_pnl,
    last_updated     = excluded.last_updated
`;

/** 거래 1건으로 보유 상태를 업데이트한다. */
function applyTransaction(h: HoldingState, tx: TxRow): void {
  if (tx.security) h.securityName = tx.security;

  if (BUY_TYPES.has(tx.type)) {
    const qty = tx.quantity;
    // 단가: unit_price 우선, 없으면 금액÷수량으로 추정
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
      // 매도된 비율만큼 총 매수원금 차감
      h.totalBuyAmount = Math.max(0, h.totalBuyAmount - h.avgBuyPrice * qty);
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
           COALESCE(quantity, 0)   AS quantity,
           COALESCE(unit_price, 0) AS unit_price,
           amount
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
        quantity: 0,
        avgBuyPrice: 0,
        totalBuyAmount: 0,
        realizedPnl: 0,
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
        accountId, code, h.securityName,
        h.quantity, h.avgBuyPrice, h.totalBuyAmount, h.realizedPnl
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
           COALESCE(quantity, 0)   AS quantity,
           COALESCE(unit_price, 0) AS unit_price,
           amount
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
    quantity: 0,
    avgBuyPrice: 0,
    totalBuyAmount: 0,
    realizedPnl: 0,
  };
  for (const tx of txRows) applyTransaction(h, tx);

  db.prepare(UPSERT_SQL).run(
    accountId, securityCode, h.securityName,
    h.quantity, h.avgBuyPrice, h.totalBuyAmount, h.realizedPnl
  );
}
