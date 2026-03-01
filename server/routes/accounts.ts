import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// GET /api/accounts?type=bank|securities
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { type } = req.query;
  const accounts = type
    ? db
        .prepare('SELECT * FROM accounts WHERE type = ? ORDER BY created_at ASC')
        .all(type as string)
    : db.prepare('SELECT * FROM accounts ORDER BY created_at ASC').all();
  res.json(accounts);
});

// POST /api/accounts
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { name, institution, type, account_number, color } = req.body as {
    name?: string;
    institution?: string;
    type?: string;
    account_number?: string;
    color?: string;
  };

  if (!name?.trim() || !institution?.trim() || !type) {
    res.status(400).json({ error: '필수 항목(계좌 별칭, 금융 기관명, 유형)을 입력하세요.' });
    return;
  }
  if (type !== 'bank' && type !== 'securities') {
    res.status(400).json({ error: '계좌 유형은 bank 또는 securities여야 합니다.' });
    return;
  }

  const result = db
    .prepare(
      `INSERT INTO accounts (name, institution, type, account_number, color)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      name.trim(),
      institution.trim(),
      type,
      account_number?.trim() || null,
      color || '#4F86C6'
    );

  const newId = Number(result.lastInsertRowid);
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(newId);
  res.status(201).json(account);
});

// PUT /api/accounts/:id
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { name, institution, account_number, color, balance } = req.body as {
    name?: string;
    institution?: string;
    account_number?: string;
    color?: string;
    balance?: number;
  };

  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: '계좌를 찾을 수 없습니다.' });
    return;
  }
  if (!name?.trim() || !institution?.trim()) {
    res.status(400).json({ error: '계좌 별칭과 금융 기관명은 필수입니다.' });
    return;
  }

  db.prepare(
    `UPDATE accounts
     SET name = ?, institution = ?, account_number = ?, color = ?, balance = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    name.trim(),
    institution.trim(),
    account_number?.trim() || null,
    color || '#4F86C6',
    balance ?? 0,
    id
  );

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  res.json(account);
});

// DELETE /api/accounts/:id
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);

  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: '계좌를 찾을 수 없습니다.' });
    return;
  }

  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  res.status(204).end();
});

export default router;
