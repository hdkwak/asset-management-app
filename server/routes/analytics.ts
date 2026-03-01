import { Router, Request, Response } from 'express';
import { getDb } from '../db';

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

export default router;
