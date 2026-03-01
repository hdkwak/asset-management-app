import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// ── GET /api/settings ──────────────────────────────────────────────────────────
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT key, value FROM app_settings')
    .all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  res.json(settings);
});

// ── PUT /api/settings/:key ─────────────────────────────────────────────────────
router.put('/:key', (req: Request, res: Response) => {
  const { key } = req.params;
  const { value } = req.body as { value: string };
  if (value === undefined) {
    res.status(400).json({ error: 'value가 필요합니다.' });
    return;
  }
  const db = getDb();
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, String(value));
  res.json({ key, value: String(value) });
});

export default router;
