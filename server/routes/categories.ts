import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// GET /api/categories[?is_income=0|1]
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { is_income } = req.query as Record<string, string>;
  const rows = is_income !== undefined
    ? db.prepare('SELECT * FROM categories WHERE is_income = ? ORDER BY name ASC')
        .all(Number(is_income))
    : db.prepare('SELECT * FROM categories ORDER BY is_income DESC, name ASC').all();
  res.json(rows);
});

// POST /api/categories
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { name, color = '#6B7280', is_income = 0, icon = 'tag' } = req.body as {
    name: string; color?: string; is_income?: number; icon?: string;
  };
  if (!name?.trim()) { res.status(400).json({ error: '이름은 필수입니다.' }); return; }

  const result = db
    .prepare('INSERT INTO categories (name, color, is_income, icon) VALUES (?, ?, ?, ?)')
    .run(name.trim(), color, Number(is_income), icon);
  res.status(201).json(
    db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(result.lastInsertRowid))
  );
});

// PUT /api/categories/:id
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { name, color, is_income, icon } = req.body as {
    name: string; color: string; is_income: number; icon: string;
  };
  db.prepare(
    'UPDATE categories SET name=?, color=?, is_income=?, icon=? WHERE id=?'
  ).run(name, color, Number(is_income), icon, id);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(id));
});

// DELETE /api/categories/:id
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  // Unlink transactions
  db.prepare('UPDATE bank_transactions SET category_id = NULL WHERE category_id = ?').run(id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.status(204).end();
});

export default router;
