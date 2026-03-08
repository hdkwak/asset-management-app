import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { buildPortfolioHistory } from '../services/portfolioHistory';

const router = Router();

type SqlParam = string | number | null;

function pct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function monthRange(year: number, month: number): [string, string] {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return [from, to];
}

// GET /api/analytics/bank?account_id=<id>|all&year=<YYYY>&month=<MM>
router.get('/bank', (req: Request, res: Response) => {
  const db = getDb();
  const q = req.query as Record<string, string>;
  const accountId = q.account_id;
  const isAll = !accountId || accountId === 'all';

  const now = new Date();
  const targetYear = Number(q.year) || now.getFullYear();
  const targetMonth = q.month ? Number(q.month) : null;

  // Account filter (safe: either fixed SQL or numeric cast)
  const accFilter = isAll
    ? `bt.account_id IN (SELECT id FROM accounts WHERE type = 'bank')`
    : `bt.account_id = ${Number(accountId)}`;

  const accFilterSimple = isAll
    ? `account_id IN (SELECT id FROM accounts WHERE type = 'bank')`
    : `account_id = ${Number(accountId)}`;

  // Selected period
  let [periodFrom, periodTo]: [string, string] = targetMonth
    ? monthRange(targetYear, targetMonth)
    : [`${targetYear}-01-01`, `${targetYear}-12-31`];

  // ── Summary: this month vs last month ──────────────────────────────────────
  const thisNow = new Date();
  const [tmFrom, tmTo] = monthRange(thisNow.getFullYear(), thisNow.getMonth() + 1);
  const [lmFrom, lmTo] = monthRange(thisNow.getFullYear(), thisNow.getMonth());

  function getSummary(from: string, to: string): { income: number; expense: number; net: number } {
    const row = db.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
         COALESCE(ABS(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)), 0) as expense
       FROM bank_transactions bt
       WHERE ${accFilter} AND date >= ? AND date <= ?`
    ).get(from, to) as { income: number; expense: number };
    return { income: row.income, expense: row.expense, net: row.income - row.expense };
  }

  const thisMonth = getSummary(tmFrom, tmTo);
  const lastMonth = getSummary(lmFrom, lmTo);

  // ── Monthly: last 12 months ───────────────────────────────────────────────
  const monthly = db.prepare(
    `SELECT
       strftime('%Y-%m', date) as month,
       COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
       COALESCE(ABS(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)), 0) as expense
     FROM bank_transactions bt
     WHERE ${accFilter} AND date >= date('now', '-11 months', 'start of month')
     GROUP BY month
     ORDER BY month`
  ).all() as { month: string; income: number; expense: number }[];

  const monthlyWithNet = monthly.map((m) => ({ ...m, net: m.income - m.expense }));

  // ── By Category: selected period, expenses only ───────────────────────────
  const byCatRaw = db.prepare(
    `SELECT
       COALESCE(bt.category_id, -1) as category_id,
       COALESCE(c.name, '미분류') as category_name,
       COALESCE(c.color, '#9CA3AF') as color,
       COALESCE(c.icon, 'tag') as icon,
       ABS(SUM(bt.amount)) as amount,
       COUNT(*) as count
     FROM bank_transactions bt
     LEFT JOIN categories c ON c.id = bt.category_id
     WHERE ${accFilter} AND bt.amount < 0
       AND bt.date >= ? AND bt.date <= ?
     GROUP BY bt.category_id
     ORDER BY amount DESC`
  ).all(periodFrom, periodTo) as {
    category_id: number; category_name: string; color: string; icon: string;
    amount: number; count: number;
  }[];

  const totalExpense = byCatRaw.reduce((s, r) => s + r.amount, 0);
  const byCategory = byCatRaw.map((r) => ({
    ...r,
    ratio: totalExpense > 0 ? Math.round((r.amount / totalExpense) * 1000) / 10 : 0,
  }));

  // ── Daily Balance: selected period ────────────────────────────────────────
  const dailyBalance = db.prepare(
    `SELECT date, MAX(balance) as balance
     FROM bank_transactions bt
     WHERE ${accFilterSimple} AND date >= ? AND date <= ? AND balance > 0
     GROUP BY date
     ORDER BY date`
  ).all(periodFrom, periodTo) as { date: string; balance: number }[];

  // ── Category Monthly: last 6 months (for stacked bar) ─────────────────────
  const categoryMonthly = db.prepare(
    `SELECT
       strftime('%Y-%m', bt.date) as month,
       COALESCE(c.name, '미분류') as category_name,
       COALESCE(c.color, '#9CA3AF') as color,
       ABS(SUM(bt.amount)) as amount
     FROM bank_transactions bt
     LEFT JOIN categories c ON c.id = bt.category_id
     WHERE ${accFilter} AND bt.amount < 0
       AND bt.date >= date('now', '-5 months', 'start of month')
     GROUP BY month, bt.category_id
     ORDER BY month, amount DESC`
  ).all() as { month: string; category_name: string; color: string; amount: number }[];

  res.json({
    summary: {
      thisMonth,
      lastMonth,
      incomeChange: pct(thisMonth.income, lastMonth.income),
      expenseChange: pct(thisMonth.expense, lastMonth.expense),
    },
    monthly: monthlyWithNet,
    byCategory,
    dailyBalance,
    categoryMonthly,
  });
});

// GET /api/analytics/securities?account_id=<id>|all
router.get('/securities', (req: Request, res: Response) => {
  const db = getDb();
  const q = req.query as Record<string, string>;
  const accountIdParam = q.account_id ?? 'all';
  const isAll = !accountIdParam || accountIdParam === 'all';
  const accountId = isAll ? null : Number(accountIdParam);

  // USD/KRW 환율
  const rateRow = db
    .prepare("SELECT value FROM app_settings WHERE key = 'usd_krw_rate'")
    .get() as { value: string } | undefined;
  const usdKrwRate = rateRow ? parseFloat(rateRow.value) || 1300 : 1300;

  // 평가금액: USD = Stooq 시세(없으면 매입단가) × qty × 환율 / KRW = qty × 현재주가
  const evalExpr = `CASE WHEN h.currency = 'USD'
    THEN h.quantity * CASE WHEN COALESCE(pc.current_price, 0) > 0
      THEN pc.current_price ELSE h.avg_buy_price_usd END * ${usdKrwRate}
    ELSE h.quantity * COALESCE(pc.current_price, h.avg_buy_price)
  END`;
  // 매입원가: USD = total_buy_usd × 현재환율 / KRW = total_buy_amount
  const costExpr = `CASE WHEN h.currency = 'USD'
    THEN h.total_buy_usd * ${usdKrwRate}
    ELSE h.total_buy_amount
  END`;

  if (!isAll && (!accountId || isNaN(accountId))) {
    res.status(400).json({ error: 'account_id가 올바르지 않습니다.' });
    return;
  }

  // LIKE-based matching covers variants like '배당금입금', 'ETF분배금입금', 'ETF/상장클래스 분배금입금'
  const DIVIDEND_COND = "(st.type LIKE '%배당%' OR st.type LIKE '%분배금%' OR st.type LIKE '%이자수령%')";

  // Dynamic filters embedded as safe numbers
  const holdingAndFilter = isAll ? '' : `AND h.account_id = ${accountId}`;
  const holdingQtyFilter = isAll
    ? 'WHERE h.quantity > 0'
    : `WHERE h.quantity > 0 AND h.account_id = ${accountId}`;
  const holdingFilter = isAll ? '' : `WHERE h.account_id = ${accountId}`;
  const txAndFilter = isAll ? '' : `AND st.account_id = ${accountId}`;

  // ── Summary ────────────────────────────────────────────────────────────────
  const summaryRow = db.prepare(`
    SELECT
      COALESCE(SUM(${costExpr}), 0)                    AS total_buy_amount,
      COALESCE(SUM(${evalExpr}), 0)                    AS total_eval_amount,
      COALESCE(SUM(CASE WHEN h.currency='USD' THEN h.realized_pnl_usd*${usdKrwRate} ELSE h.realized_pnl END), 0) AS total_realized_pnl,
      COUNT(CASE WHEN h.quantity > 0 THEN 1 END)       AS holding_count,
      COUNT(DISTINCT h.account_id)                     AS account_count
    FROM holdings h
    LEFT JOIN price_cache pc ON pc.security_code = COALESCE(NULLIF(h.ticker_code,''), h.security_code)
    ${holdingFilter}
  `).get() as {
    total_buy_amount: number;
    total_eval_amount: number;
    total_realized_pnl: number;
    holding_count: number;
    account_count: number;
  };

  const divRow = db.prepare(`
    SELECT COALESCE(SUM(ABS(st.amount)), 0) AS total_dividend
    FROM securities_transactions st
    WHERE ${DIVIDEND_COND}
    ${txAndFilter}
  `).get() as { total_dividend: number };

  const totalEval = summaryRow.total_eval_amount || 0;
  const totalBuy = summaryRow.total_buy_amount || 0;

  const summary = {
    total_buy_amount: totalBuy,
    total_eval_amount: totalEval,
    total_unrealized_pnl: totalEval - totalBuy,
    total_realized_pnl: summaryRow.total_realized_pnl || 0,
    holding_count: summaryRow.holding_count || 0,
    account_count: summaryRow.account_count || 0,
    total_dividend: divRow.total_dividend || 0,
  };

  // ── By Security (종목별 합산 — 같은 종목이 여러 계좌에 분산 보유된 경우 합산) ──────
  const bySecurityRows = db.prepare(`
    SELECT
      h.security_name,
      MIN(h.security_code)                                                       AS security_code,
      SUM(${costExpr})                                                           AS total_buy_amount,
      SUM(${evalExpr})                                                           AS eval_amount,
      SUM(CASE WHEN h.currency='USD' THEN h.realized_pnl_usd*${usdKrwRate} ELSE h.realized_pnl END) AS realized_pnl,
      SUM(h.quantity)                                                            AS quantity,
      MAX(COALESCE(pc.current_price, h.avg_buy_price))                           AS current_price
    FROM holdings h
    LEFT JOIN price_cache pc ON pc.security_code = COALESCE(NULLIF(h.ticker_code,''), h.security_code)
    ${holdingQtyFilter}
    GROUP BY h.security_name
    ORDER BY eval_amount DESC
  `).all() as {
    security_code: string;
    security_name: string;
    total_buy_amount: number;
    current_price: number;
    eval_amount: number;
    realized_pnl: number;
    avg_buy_price: number;
    quantity: number;
  }[];

  const bySecurity = bySecurityRows.map((r) => {
    const unrealizedPnl = r.total_buy_amount > 0 ? r.eval_amount - r.total_buy_amount : 0;
    return {
      ...r,
      avg_buy_price: 0,
      account_name: '',
      account_color: '',
      ratio: totalEval > 0 ? Math.round((r.eval_amount / totalEval) * 1000) / 10 : 0,
      unrealized_pnl: unrealizedPnl,
      unrealized_pnl_rate: r.total_buy_amount > 0
        ? Math.round((unrealizedPnl / r.total_buy_amount) * 10000) / 100
        : 0,
    };
  });

  // ── By Account ────────────────────────────────────────────────────────────
  const byAccountRows = db.prepare(`
    SELECT
      h.account_id,
      a.name  AS account_name,
      a.color AS account_color,
      COALESCE(SUM(${evalExpr}), 0) AS eval_amount
    FROM holdings h
    JOIN accounts a ON a.id = h.account_id
    LEFT JOIN price_cache pc ON pc.security_code = COALESCE(NULLIF(h.ticker_code,''), h.security_code)
    ${holdingQtyFilter}
    GROUP BY h.account_id
    ORDER BY eval_amount DESC
  `).all() as {
    account_id: number;
    account_name: string;
    account_color: string;
    eval_amount: number;
  }[];

  const byAccount = byAccountRows.map((r) => ({
    ...r,
    ratio: totalEval > 0 ? Math.round((r.eval_amount / totalEval) * 1000) / 10 : 0,
  }));

  // ── PnL Ranking ───────────────────────────────────────────────────────────
  const pnlRawRows = db.prepare(`
    SELECT
      h.security_name,
      MIN(h.security_code) AS security_code,
      SUM(${costExpr}) AS total_buy_amount,
      SUM(${evalExpr}) AS eval_amount,
      SUM(CASE WHEN h.currency='USD' THEN h.realized_pnl_usd*${usdKrwRate} ELSE h.realized_pnl END) AS realized_pnl
    FROM holdings h
    LEFT JOIN price_cache pc ON pc.security_code = COALESCE(NULLIF(h.ticker_code,''), h.security_code)
    ${holdingQtyFilter}
    GROUP BY h.security_name
  `).all() as {
    security_code: string;
    security_name: string;
    total_buy_amount: number;
    eval_amount: number;
    realized_pnl: number;
  }[];

  const pnlWithCalc = pnlRawRows.map((r) => {
    const unrealizedPnl = r.total_buy_amount > 0 ? r.eval_amount - r.total_buy_amount : 0;
    const unrealizedPnlRate = r.total_buy_amount > 0
        ? Math.round((unrealizedPnl / r.total_buy_amount) * 10000) / 100
        : 0;
    return { ...r, unrealized_pnl: unrealizedPnl, unrealized_pnl_rate: unrealizedPnlRate };
  });

  // Top 15 by abs(pnl_rate), sorted ascending (most negative first)
  const pnlRanking = pnlWithCalc
    .sort((a, b) => Math.abs(b.unrealized_pnl_rate) - Math.abs(a.unrealized_pnl_rate))
    .slice(0, 15)
    .sort((a, b) => a.unrealized_pnl_rate - b.unrealized_pnl_rate);

  // ── Monthly Dividend ───────────────────────────────────────────────────────
  const monthlyDividend = db.prepare(`
    SELECT
      strftime('%Y-%m', st.date) AS month,
      COALESCE(SUM(ABS(st.amount)), 0) AS amount
    FROM securities_transactions st
    WHERE ${DIVIDEND_COND}
    ${txAndFilter}
    AND st.date >= date('now', '-11 months', 'start of month')
    GROUP BY month
    ORDER BY month
  `).all() as { month: string; amount: number }[];

  // ── Portfolio History ──────────────────────────────────────────────────────
  const portfolioHistory = buildPortfolioHistory(accountId);

  res.json({
    summary,
    by_security: bySecurity,
    by_account: byAccount,
    pnl_ranking: pnlRanking,
    monthly_dividend: monthlyDividend,
    portfolio_history: portfolioHistory,
  });
});

export default router;
