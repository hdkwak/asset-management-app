import { Router } from 'express';
import { getDb } from '../db';
import { cacheGet, cacheSet } from '../utils/memoryCache';

const router = Router();

const CACHE_KEY = 'summary';
const CACHE_TTL = 30_000; // 30s

router.get('/', (_req, res) => {
  const cached = cacheGet<object>(CACHE_KEY);
  if (cached) {
    res.json(cached);
    return;
  }

  const db = getDb();

  const bankRow = db
    .prepare(`SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE type = 'bank'`)
    .get() as { total: number };

  const secRow = db
    .prepare(`SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE type = 'securities'`)
    .get() as { total: number };

  const bankCountRow = db
    .prepare(`SELECT COUNT(*) as cnt FROM accounts WHERE type = 'bank'`)
    .get() as { cnt: number };

  const secCountRow = db
    .prepare(`SELECT COUNT(*) as cnt FROM accounts WHERE type = 'securities'`)
    .get() as { cnt: number };

  // Real securities evaluation from holdings × price_cache
  const secEvalRow = db.prepare(`
    SELECT COALESCE(SUM(h.quantity * COALESCE(pc.current_price, h.avg_buy_price)), 0) AS eval
    FROM holdings h
    LEFT JOIN price_cache pc ON pc.security_code = COALESCE(NULLIF(h.ticker_code,''), h.security_code)
    WHERE h.quantity > 0
  `).get() as { eval: number };

  // Top 5 holdings by abs unrealized pnl rate
  type RawHolding = { security_name: string; eval_amount: number; total_buy_amount: number };
  const rawRows = db.prepare(`
    SELECT h.security_name,
      SUM(h.quantity * COALESCE(pc.current_price, h.avg_buy_price)) AS eval_amount,
      SUM(h.total_buy_amount) AS total_buy_amount
    FROM holdings h
    LEFT JOIN price_cache pc ON pc.security_code = COALESCE(NULLIF(h.ticker_code,''), h.security_code)
    WHERE h.quantity > 0
    GROUP BY h.security_name
    ORDER BY ABS((SUM(h.quantity * COALESCE(pc.current_price, h.avg_buy_price)) - SUM(h.total_buy_amount)) / NULLIF(SUM(h.total_buy_amount), 0)) DESC
    LIMIT 5
  `).all() as RawHolding[];

  const topHoldings = rawRows.map(r => ({
    ...r,
    unrealized_pnl_rate: r.total_buy_amount > 0
      ? Math.round(((r.eval_amount - r.total_buy_amount) / r.total_buy_amount) * 10000) / 100
      : 0,
  }));

  // This-month income / expense KPI (bank transactions only)
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  const thisMonthStr = thisMonthStart.toISOString().slice(0, 7); // 'YYYY-MM'
  const monthlyKpi = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as expense
    FROM bank_transactions
    WHERE strftime('%Y-%m', date) = ?
  `).get(thisMonthStr) as { income: number; expense: number };

  const recentBank = db.prepare(`
    SELECT bt.id, bt.date, bt.amount,
           COALESCE(NULLIF(bt.payee, ''), '(거래)') as description,
           a.name as account_name, a.color as account_color,
           'bank' as account_type, bt.created_at
    FROM bank_transactions bt
    JOIN accounts a ON a.id = bt.account_id
    ORDER BY bt.date DESC, bt.id DESC
    LIMIT 7
  `).all() as Record<string, unknown>[];

  const recentSec = db.prepare(`
    SELECT st.id, st.date, st.amount,
           COALESCE(NULLIF(st.security, ''), NULLIF(st.description, ''), '(거래)') as description,
           a.name as account_name, a.color as account_color,
           'securities' as account_type, st.created_at
    FROM securities_transactions st
    JOIN accounts a ON a.id = st.account_id
    ORDER BY st.date DESC, st.id DESC
    LIMIT 7
  `).all() as Record<string, unknown>[];

  const recentTransactions = [...recentBank, ...recentSec]
    .sort((a, b) => {
      const ka = `${a.date}|${a.created_at}`;
      const kb = `${b.date}|${b.created_at}`;
      return (kb as string).localeCompare(ka as string);
    })
    .slice(0, 7);

  const result = {
    totalBankBalance: bankRow.total,
    totalSecuritiesBalance: secRow.total,
    totalSecuritiesEval: secEvalRow.eval,
    totalAssets: bankRow.total + secEvalRow.eval,
    bankAccountCount: bankCountRow.cnt,
    securitiesAccountCount: secCountRow.cnt,
    thisMonthIncome: monthlyKpi.income,
    thisMonthExpense: monthlyKpi.expense,
    thisMonthNet: monthlyKpi.income - monthlyKpi.expense,
    topHoldings,
    recentTransactions,
  };

  cacheSet(CACHE_KEY, result, CACHE_TTL);
  res.json(result);
});

export { CACHE_KEY as SUMMARY_CACHE_KEY };
export default router;
