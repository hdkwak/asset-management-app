import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { recalculateHoldings, recalculateHoldingForSecurity } from '../services/holdingsEngine';

const router = Router();

type SqlParam = string | number | null;

export function recalculateBankBalance(accountId: number): void {
  const db = getDb();

  // Use latest non-zero balance if any transaction has balance data
  const hasBalance = db
    .prepare(
      `SELECT 1 FROM bank_transactions
       WHERE account_id = ? AND balance IS NOT NULL AND balance != 0
       LIMIT 1`
    )
    .get(accountId);

  if (hasBalance) {
    db.prepare(
      `UPDATE accounts
         SET balance = (
           SELECT COALESCE(balance, 0)
           FROM bank_transactions
           WHERE account_id = ?
           ORDER BY date DESC, id DESC
           LIMIT 1
         ),
             updated_at = datetime('now')
       WHERE id = ? AND type = 'bank'`
    ).run(accountId, accountId);
  } else {
    db.prepare(
      `UPDATE accounts
         SET balance    = COALESCE((SELECT SUM(amount) FROM bank_transactions WHERE account_id = ?), 0),
             updated_at = datetime('now')
       WHERE id = ? AND type = 'bank'`
    ).run(accountId, accountId);
  }
}

// ── GET /api/transactions ─────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const q = req.query as Record<string, string>;

  const accountId  = q.account_id ? Number(q.account_id) : null;
  const group      = q.group as 'bank' | 'securities' | undefined;
  const search     = q.search?.trim() ?? '';
  const dateFrom   = q.date_from ?? '';
  const dateTo     = q.date_to ?? '';
  const amountMin  = q.amount_min !== undefined && q.amount_min !== '' ? Number(q.amount_min) : null;
  const amountMax  = q.amount_max !== undefined && q.amount_max !== '' ? Number(q.amount_max) : null;
  const categoryId = q.category_id ? Number(q.category_id) : null;
  const secType    = q.sec_type ?? '';
  const incomeType = q.income_type ?? '';
  const page       = Math.max(1, Number(q.page ?? 1));
  const limit      = Math.min(200, Math.max(1, Number(q.limit ?? 50)));
  const sortOrder  = (q.sort_order ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Determine account type (which table)
  let accountType: 'bank' | 'securities';
  if (group === 'bank' || group === 'securities') {
    accountType = group;
  } else if (accountId) {
    const acc = db
      .prepare('SELECT type FROM accounts WHERE id = ?')
      .get(accountId) as { type: string } | undefined;
    if (!acc) { res.status(404).json({ error: '계좌를 찾을 수 없습니다.' }); return; }
    accountType = acc.type as 'bank' | 'securities';
  } else {
    res.status(400).json({ error: 'account_id 또는 group 파라미터가 필요합니다.' });
    return;
  }

  const table = accountType === 'bank' ? 'bank_transactions' : 'securities_transactions';

  // Sort column whitelist (SQL-injection safe)
  const bankSortMap: Record<string, string> = {
    date: 't.date', amount: 't.amount', payee: 't.payee',
    balance: 't.balance', created_at: 't.created_at',
  };
  const secSortMap: Record<string, string> = {
    date: 't.date', amount: 't.amount', security: 't.security',
    type: 't.type', created_at: 't.created_at',
  };
  const sortMap = accountType === 'bank' ? bankSortMap : secSortMap;
  const sortCol = sortMap[q.sort_by] ?? 't.date';

  // Build WHERE clauses
  const where: string[] = [];
  const params: SqlParam[] = [];

  if (accountId) {
    where.push('t.account_id = ?');
    params.push(accountId);
  }
  if (dateFrom)   { where.push('t.date >= ?');        params.push(dateFrom); }
  if (dateTo)     { where.push('t.date <= ?');         params.push(dateTo); }
  if (amountMin !== null) { where.push('ABS(t.amount) >= ?'); params.push(amountMin); }
  if (amountMax !== null) { where.push('ABS(t.amount) <= ?'); params.push(amountMax); }

  if (accountType === 'bank') {
    if (search) {
      where.push('(t.payee LIKE ? OR t.note LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (categoryId !== null) { where.push('t.category_id = ?'); params.push(categoryId); }
    if (incomeType === 'income')  where.push('t.amount > 0');
    if (incomeType === 'expense') where.push('t.amount < 0');
  } else {
    if (search) {
      where.push('(t.security LIKE ? OR t.description LIKE ? OR t.security_code LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (secType) { where.push('t.type = ?'); params.push(secType); }
  }

  const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const baseFrom = `FROM ${table} t JOIN accounts a ON a.id = t.account_id ${whereSQL}`;

  // Count
  const { total } = (db.prepare(`SELECT COUNT(*) as total ${baseFrom}`) as unknown as {
    get: (...p: SqlParam[]) => { total: number };
  }).get(...params);

  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;

  // Data
  const dataParams: SqlParam[] = [...params, limit, offset];
  const data = (db.prepare(
    `SELECT t.*, a.name as account_name, a.color as account_color ${baseFrom}
     ORDER BY ${sortCol} ${sortOrder}, t.id ${sortOrder}
     LIMIT ? OFFSET ?`
  ) as unknown as { all: (...p: SqlParam[]) => unknown[] }).all(...dataParams);

  res.json({ data, total, page, totalPages });
});

// ── POST /api/transactions ────────────────────────────────────────────────────
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { account_type, account_id, ...fields } = req.body as Record<string, unknown>;

  if (!account_id || !account_type) {
    res.status(400).json({ error: 'account_id와 account_type은 필수입니다.' });
    return;
  }
  const id = Number(account_id);

  if (account_type === 'bank') {
    const { date, payee = '', category_id = null, amount, balance = 0, note = '' } = fields as {
      date: string; payee?: string; category_id?: number | null;
      amount: number; balance?: number; note?: string;
    };
    if (!date || amount === undefined) {
      res.status(400).json({ error: '날짜와 금액은 필수입니다.' }); return;
    }
    const result = db
      .prepare(
        `INSERT INTO bank_transactions (account_id, date, payee, category_id, amount, balance, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, date, payee, category_id, Number(amount), Number(balance), note);
    recalculateBankBalance(id);
    res.status(201).json(
      db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(Number(result.lastInsertRowid))
    );
  } else {
    const {
      date, type = '기타', security = '', security_code = '',
      description = '', amount, balance = 0, quantity = 0, unit_price = 0,
    } = fields as {
      date: string; type?: string; security?: string; security_code?: string;
      description?: string; amount: number; balance?: number;
      quantity?: number; unit_price?: number;
    };
    if (!date || amount === undefined) {
      res.status(400).json({ error: '날짜와 금액은 필수입니다.' }); return;
    }
    const result = db
      .prepare(
        `INSERT INTO securities_transactions
           (account_id, date, type, security, security_code, description, amount, balance, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, date, type, security, security_code, description, Number(amount), Number(balance), Number(quantity), Number(unit_price));
    recalculateHoldingForSecurity(id, security_code);
    res.status(201).json(
      db.prepare('SELECT * FROM securities_transactions WHERE id = ?').get(Number(result.lastInsertRowid))
    );
  }
});

// ── PUT /api/transactions/bulk-category ──────────────────────────────────────
router.put('/bulk-category', (req: Request, res: Response) => {
  const db = getDb();
  const { ids, category_id } = req.body as { ids: number[]; category_id: number | null };
  if (!ids?.length) { res.status(400).json({ error: 'ids는 필수입니다.' }); return; }

  const placeholders = ids.map(() => '?').join(',');
  const catVal = category_id ?? null;

  (db.prepare(
    `UPDATE bank_transactions SET category_id = ?, updated_at = datetime('now')
     WHERE id IN (${placeholders})`
  ) as unknown as { run: (...p: (number | null)[]) => void }).run(catVal, ...ids);

  res.json({ updated: ids.length });
});

// ── PUT /api/transactions/:id ─────────────────────────────────────────────────
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const txId = Number(req.params.id);
  const { account_type, account_id, ...fields } = req.body as Record<string, unknown>;
  const aId = Number(account_id);

  if (account_type === 'bank') {
    const { date, payee = '', category_id = null, amount, balance = 0, note = '' } = fields as {
      date: string; payee?: string; category_id?: number | null;
      amount: number; balance?: number; note?: string;
    };
    db.prepare(
      `UPDATE bank_transactions
         SET date=?, payee=?, category_id=?, amount=?, balance=?, note=?, updated_at=datetime('now')
       WHERE id=?`
    ).run(date, payee, category_id, Number(amount), Number(balance), note, txId);
    recalculateBankBalance(aId);
    res.json(db.prepare('SELECT * FROM bank_transactions WHERE id=?').get(txId));
  } else {
    const {
      date, type = '기타', security = '', security_code = '',
      description = '', amount, balance = 0, quantity = 0, unit_price = 0,
    } = fields as {
      date: string; type?: string; security?: string; security_code?: string;
      description?: string; amount: number; balance?: number;
      quantity?: number; unit_price?: number;
    };
    db.prepare(
      `UPDATE securities_transactions
         SET date=?, type=?, security=?, security_code=?, description=?, amount=?, balance=?,
             quantity=?, unit_price=?, updated_at=datetime('now')
       WHERE id=?`
    ).run(date, type, security, security_code, description, Number(amount), Number(balance), Number(quantity), Number(unit_price), txId);
    recalculateHoldingForSecurity(aId, security_code);
    res.json(db.prepare('SELECT * FROM securities_transactions WHERE id=?').get(txId));
  }
});

// ── DELETE /api/transactions/bulk ─────────────────────────────────────────────
router.delete('/bulk', (req: Request, res: Response) => {
  const db = getDb();
  const { ids, account_type, account_id } = req.body as {
    ids: number[]; account_type: string; account_id?: number;
  };
  if (!ids?.length) { res.status(400).json({ error: 'ids는 필수입니다.' }); return; }

  const table = account_type === 'bank' ? 'bank_transactions' : 'securities_transactions';
  const placeholders = ids.map(() => '?').join(',');

  if (account_type === 'bank') {
    // Collect affected account IDs before deleting (for balance recalc)
    const affected = (db.prepare(
      `SELECT DISTINCT account_id FROM ${table} WHERE id IN (${placeholders})`
    ) as unknown as { all: (...p: number[]) => { account_id: number }[] }).all(...ids);

    db.prepare(`DELETE FROM ${table} WHERE id IN (${placeholders})`).run(...ids);

    for (const { account_id: aId } of affected) {
      recalculateBankBalance(aId);
    }
  } else {
    // Collect affected account IDs before deleting (for holdings recalc)
    const affected = (db.prepare(
      `SELECT DISTINCT account_id FROM ${table} WHERE id IN (${placeholders})`
    ) as unknown as { all: (...p: number[]) => { account_id: number }[] }).all(...ids);

    db.prepare(`DELETE FROM ${table} WHERE id IN (${placeholders})`).run(...ids);

    for (const { account_id: aId } of affected) {
      recalculateHoldings(aId);
    }
  }

  // Legacy: single account_id path
  if (account_type === 'bank' && account_id) {
    recalculateBankBalance(Number(account_id));
  }

  res.json({ deleted: ids.length });
});

// ── DELETE /api/transactions/:id ──────────────────────────────────────────────
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const txId = Number(req.params.id);
  const { account_type, account_id } = req.body as {
    account_type: string; account_id: number;
  };
  const aId = Number(account_id);
  const table = account_type === 'bank' ? 'bank_transactions' : 'securities_transactions';

  if (account_type === 'securities') {
    // 삭제 전 security_code 조회 (특정 종목만 재계산)
    const tx = db.prepare(`SELECT security_code FROM ${table} WHERE id = ?`).get(txId) as
      | { security_code: string }
      | undefined;
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(txId);
    recalculateHoldingForSecurity(aId, tx?.security_code ?? '');
  } else {
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(txId);
    recalculateBankBalance(aId);
  }

  res.status(204).end();
});

export default router;
