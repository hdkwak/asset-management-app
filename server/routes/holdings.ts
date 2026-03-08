import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { recalculateHoldings } from '../services/holdingsEngine';
import { calcPnlRate } from '../utils/financeCalc';

const router = Router();

// ── GET /api/holdings?account_id=<id>|all ────────────────────────────────────
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const q = req.query as Record<string, string>;
  const accountIdParam = q.account_id;
  const includeZero = q.include_zero === 'true';
  const search = q.search?.trim() ?? '';
  const sortByParam = q.sort_by ?? '';
  const sortOrderParam = (q.sort_order ?? 'asc') as 'asc' | 'desc';

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
    LEFT JOIN price_cache pc ON pc.security_code = COALESCE(NULLIF(h.ticker_code,''), h.security_code)
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

  // USD/KRW 환율 (app_settings에서 조회, 없으면 기본값 1300)
  const rateRow = db
    .prepare("SELECT value FROM app_settings WHERE key = 'usd_krw_rate'")
    .get() as { value: string } | undefined;
  const usdKrwRate = rateRow ? parseFloat(rateRow.value) || 1300 : 1300;

  // 계산 필드 추가
  const holdings = rows.map((h) => {
    const qty             = Number(h.quantity);
    const currentPrice    = Number(h.current_price);
    const totalBuyAmount  = Number(h.total_buy_amount);
    const totalBuyUsd     = Number(h.total_buy_usd);
    const avgBuyPriceUsd  = Number(h.avg_buy_price_usd);
    const realizedPnlUsd  = Number((h as Record<string, unknown>).realized_pnl_usd ?? 0);
    const realizedPnl     = Number(h.realized_pnl);
    const isUsd           = String(h.currency) === 'USD';

    // 평가금액 (KRW): USD 종목은 Stooq 시세 × qty × 환율, 없으면 매입단가 기준
    const usdPrice       = currentPrice > 0 ? currentPrice : avgBuyPriceUsd;
    const evalAmount     = isUsd
      ? qty * usdPrice * usdKrwRate
      : qty * currentPrice;

    // 매입원가 (KRW): USD 종목은 total_buy_usd × 현재환율로 환산
    // (KRW 종목은 total_buy_amount 직접 사용)
    const costBasisKrw   = isUsd ? totalBuyUsd * usdKrwRate : totalBuyAmount;

    // 미실현 손익
    const unrealizedPnl  = costBasisKrw > 0 ? evalAmount - costBasisKrw : 0;

    // 실현 손익: USD 종목은 realized_pnl_usd를 KRW로 환산
    const effectiveRealizedPnl = isUsd ? realizedPnlUsd * usdKrwRate : realizedPnl;

    return {
      ...h,
      eval_amount:           evalAmount,
      unrealized_pnl:        unrealizedPnl,
      unrealized_pnl_rate:   calcPnlRate(unrealizedPnl, costBasisKrw),
      total_pnl:             unrealizedPnl + effectiveRealizedPnl,
      // 요약 계산용 (KRW 환산 기준)
      _cost_basis_krw:       costBasisKrw,
      _realized_pnl:         effectiveRealizedPnl,
    };
  });

  // 요약 (전체 보유 종목 기준, KRW 환산 기준)
  const totalBuyAmount    = holdings.reduce((s, h) => s + h._cost_basis_krw, 0);
  const totalEvalAmount   = holdings.reduce((s, h) => s + h.eval_amount, 0);
  const totalUnrealized   = totalBuyAmount > 0 ? totalEvalAmount - totalBuyAmount : 0;
  const totalRealizedPnl  = holdings.reduce((s, h) => s + h._realized_pnl, 0);

  const lastPriceUpdate = rows
    .map((h) => h.price_fetched_at as string | null)
    .filter(Boolean)
    .sort()
    .reverse()[0] ?? null;

  // 필터링: 보유중 종목만 or 전체
  let filtered = includeZero ? holdings : holdings.filter((h) => Number(h.quantity) > 0);

  // 종목명/코드 검색
  if (search) {
    filtered = filtered.filter(
      (h) =>
        String(h.security_name).includes(search) ||
        String(h.security_code).includes(search)
    );
  }

  // 정렬
  if (sortByParam) {
    const sortable = ['eval_amount', 'unrealized_pnl', 'unrealized_pnl_rate', 'realized_pnl',
      'total_pnl', 'quantity', 'avg_buy_price', 'current_price', 'total_buy_amount'];
    if (sortable.includes(sortByParam)) {
      filtered.sort((a, b) => {
        const av = Number(a[sortByParam]) || 0;
        const bv = Number(b[sortByParam]) || 0;
        return sortOrderParam === 'asc' ? av - bv : bv - av;
      });
    }
  }

  res.json({
    holdings: filtered,
    summary: {
      total_buy_amount:          totalBuyAmount,
      total_eval_amount:         totalEvalAmount,
      total_unrealized_pnl:      totalUnrealized,
      total_unrealized_pnl_rate: calcPnlRate(totalUnrealized, totalBuyAmount),
      total_realized_pnl:        totalRealizedPnl,
      total_pnl:                 totalUnrealized + totalRealizedPnl,
      last_price_update:         lastPriceUpdate,
      usd_krw_rate:              usdKrwRate,
    },
  });
});

// ── PUT /api/holdings/:account_id/:security_code/ticker ──────────────────────
// Sets the Naver-compatible ticker code. If another holding in the same account
// already has the same ticker_code, the two are automatically merged:
// all transactions from the duplicate are re-keyed to this security_code.
router.put('/:account_id/:security_code/ticker', (req: Request, res: Response) => {
  const accountId = Number(req.params.account_id);
  const securityCode = req.params.security_code;
  const tickerCode = ((req.body as { ticker_code: string }).ticker_code ?? '').trim();
  if (!accountId || !securityCode) {
    res.status(400).json({ error: '필수 항목 누락' });
    return;
  }
  const db = getDb();
  db.exec('BEGIN');
  try {
    // 1. Save ticker_code
    db.prepare(
      'UPDATE holdings SET ticker_code = ? WHERE account_id = ? AND security_code = ?'
    ).run(tickerCode, accountId, securityCode);

    // 2. Auto-merge: find any other holding with the same ticker_code
    let merged = false;
    if (tickerCode) {
      const duplicates = db.prepare(
        `SELECT security_code FROM holdings
         WHERE account_id = ? AND ticker_code = ? AND security_code != ?`
      ).all(accountId, tickerCode, securityCode) as { security_code: string }[];

      for (const dup of duplicates) {
        // Migrate all transactions from duplicate security_code to this one
        db.prepare(
          `UPDATE securities_transactions SET security_code = ?
           WHERE account_id = ? AND security_code = ?`
        ).run(securityCode, accountId, dup.security_code);
        // Remove the now-empty duplicate holding
        db.prepare(
          'DELETE FROM holdings WHERE account_id = ? AND security_code = ?'
        ).run(accountId, dup.security_code);
        merged = true;
      }
    }

    db.exec('COMMIT');

    // 3. If we merged, recalculate holdings from scratch
    if (merged) recalculateHoldings(accountId);

    res.json({ success: true, merged });
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
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
