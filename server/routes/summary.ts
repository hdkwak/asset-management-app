import { Router } from 'express';
import { getDb } from '../db';

const router = Router();

router.get('/', (_req, res) => {
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

  const recentBank = db.prepare(`
    SELECT bt.id, bt.date, bt.amount,
           COALESCE(NULLIF(bt.payee, ''), '(거래)') as description,
           a.name as account_name, a.color as account_color,
           'bank' as account_type, bt.created_at
    FROM bank_transactions bt
    JOIN accounts a ON a.id = bt.account_id
    ORDER BY bt.date DESC, bt.id DESC
    LIMIT 10
  `).all() as Record<string, unknown>[];

  const recentSec = db.prepare(`
    SELECT st.id, st.date, st.amount,
           COALESCE(NULLIF(st.security, ''), NULLIF(st.description, ''), '(거래)') as description,
           a.name as account_name, a.color as account_color,
           'securities' as account_type, st.created_at
    FROM securities_transactions st
    JOIN accounts a ON a.id = st.account_id
    ORDER BY st.date DESC, st.id DESC
    LIMIT 10
  `).all() as Record<string, unknown>[];

  const recentTransactions = [...recentBank, ...recentSec]
    .sort((a, b) => {
      const ka = `${a.date}|${a.created_at}`;
      const kb = `${b.date}|${b.created_at}`;
      return (kb as string).localeCompare(ka as string);
    })
    .slice(0, 10);

  res.json({
    totalBankBalance: bankRow.total,
    totalSecuritiesBalance: secRow.total,
    totalAssets: bankRow.total + secRow.total,
    bankAccountCount: bankCountRow.cnt,
    securitiesAccountCount: secCountRow.cnt,
    recentTransactions,
  });
});

export default router;
