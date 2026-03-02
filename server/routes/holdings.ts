import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { recalculateHoldings } from '../services/holdingsEngine';
import { calcPnlRate } from '../utils/financeCalc';

const router = Router();

// ── GET /api/holdings?account_id=<id>|all ────────────────────────────────────
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const accountIdParam = req.query.account_id as string | undefined;

  let rows: Record<string, unknown>[];

  const baseQuery = `
    SELECT h.*, a.name AS account_name,
           COALESCE(pc.current_price, 0)  AS current_price,
           COALESCE(pc.prev_close, 0)     AS prev_close,
           COALESCE(pc.change_amount, 0)  AS change_amount,
           COALESCE(pc.change_rate, 0)    AS change_rate,
           COALESCE(pc.market, '')        AS market,
           pc.fetched_at                  AS price_fetched_at
    FROM holdings h
    JOIN accounts a ON a.id = h.account_id
    LEFT JOIN price_cache pc ON pc.security_code = h.security_code
  `;

  if (!accountIdParam || accountIdParam === 'all') {
    rows = db.prepare(`${baseQuery} ORDER BY h.account_id, h.security_code`).all() as Record<
      string,
      unknown
    >[];
  } else {
    rows = db
      .prepare(`${baseQuery} WHERE h.account_id = ? ORDER BY h.security_code`)
      .all(Number(accountIdParam)) as Record<string, unknown>[];
  }

  // 계산 필드 추가
  const holdings = rows.map((h) => {
    const qty            = Number(h.quantity);
    const currentPrice   = Number(h.current_price);
    const totalBuyAmount = Number(h.total_buy_amount);
    const realizedPnl    = Number(h.realized_pnl);
    const evalAmount     = qty * currentPrice;
    const unrealizedPnl  = totalBuyAmount > 0 ? evalAmount - totalBuyAmount : 0;

    return {
      ...h,
      eval_amount:           evalAmount,
      unrealized_pnl:        unrealizedPnl,
      unrealized_pnl_rate:   calcPnlRate(unrealizedPnl, totalBuyAmount),
      total_pnl:             unrealizedPnl + realizedPnl,
      // 요약 계산용 앨리어스 (타입 명확화)
      _total_buy_amount:     totalBuyAmount,
      _realized_pnl:         realizedPnl,
    };
  });

  // 요약
  const totalBuyAmount    = holdings.reduce((s, h) => s + h._total_buy_amount, 0);
  const totalEvalAmount   = holdings.reduce((s, h) => s + h.eval_amount, 0);
  const totalUnrealized   = totalBuyAmount > 0 ? totalEvalAmount - totalBuyAmount : 0;
  const totalRealizedPnl  = holdings.reduce((s, h) => s + h._realized_pnl, 0);

  const lastPriceUpdate = rows
    .map((h) => h.price_fetched_at as string | null)
    .filter(Boolean)
    .sort()
    .reverse()[0] ?? null;

  res.json({
    holdings,
    summary: {
      total_buy_amount:          totalBuyAmount,
      total_eval_amount:         totalEvalAmount,
      total_unrealized_pnl:      totalUnrealized,
      total_unrealized_pnl_rate: calcPnlRate(totalUnrealized, totalBuyAmount),
      total_realized_pnl:        totalRealizedPnl,
      total_pnl:                 totalUnrealized + totalRealizedPnl,
      last_price_update:         lastPriceUpdate,
    },
  });
});

// ── POST /api/holdings/recalculate?account_id=<id> ───────────────────────────
router.post('/recalculate', (req: Request, res: Response) => {
  const accountId = req.query.account_id ? Number(req.query.account_id) : null;
  if (!accountId) {
    res.status(400).json({ error: 'account_id가 필요합니다.' });
    return;
  }
  try {
    recalculateHoldings(accountId);
    res.json({ success: true, account_id: accountId });
  } catch (err) {
    res.status(500).json({ error: `재계산 실패: ${(err as Error).message}` });
  }
});

export default router;
