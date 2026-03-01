import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// GET /api/profiles?account_type=bank|securities
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { account_type } = req.query;
  const profiles = account_type
    ? db
        .prepare('SELECT * FROM institution_profiles WHERE account_type = ? ORDER BY is_preset DESC, institution ASC')
        .all(account_type as string)
    : db
        .prepare('SELECT * FROM institution_profiles ORDER BY is_preset DESC, institution ASC')
        .all();
  res.json(profiles);
});

// GET /api/profiles/:id
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const profile = db
    .prepare('SELECT * FROM institution_profiles WHERE id = ?')
    .get(Number(req.params.id));
  if (!profile) { res.status(404).json({ error: '프로파일을 찾을 수 없습니다.' }); return; }
  res.json(profile);
});

// POST /api/profiles — create a custom profile
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const {
    institution, account_type, encoding = 'utf-8', column_map,
    date_format = 'YYYY-MM-DD', amount_sign = 'separate', skip_rows = 0,
    file_type = 'csv', sheet_index = 0, header_row = -1, notes = '',
  } = req.body as {
    institution: string; account_type: string; encoding?: string;
    column_map: object; date_format?: string; amount_sign?: string;
    skip_rows?: number; file_type?: string; sheet_index?: number;
    header_row?: number; notes?: string;
  };

  if (!institution || !account_type || !column_map) {
    res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
    return;
  }

  const result = db
    .prepare(
      `INSERT INTO institution_profiles
         (institution, account_type, encoding, column_map, date_format, amount_sign,
          skip_rows, is_preset, file_type, sheet_index, header_row, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
    )
    .run(
      institution,
      account_type,
      encoding,
      typeof column_map === 'string' ? column_map : JSON.stringify(column_map),
      date_format,
      amount_sign,
      skip_rows,
      file_type,
      sheet_index,
      header_row,
      notes,
    );

  const profile = db
    .prepare('SELECT * FROM institution_profiles WHERE id = ?')
    .get(Number(result.lastInsertRowid));
  res.status(201).json(profile);
});

// PUT /api/profiles/:id — update custom profile only
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const existing = db
    .prepare('SELECT id, is_preset FROM institution_profiles WHERE id = ?')
    .get(id) as { id: number; is_preset: number } | undefined;

  if (!existing) { res.status(404).json({ error: '프로파일을 찾을 수 없습니다.' }); return; }
  if (existing.is_preset === 1) {
    res.status(403).json({ error: '사전 등록 프로파일은 수정할 수 없습니다.' });
    return;
  }

  const {
    institution, account_type, encoding = 'utf-8', column_map,
    date_format = 'YYYY-MM-DD', amount_sign = 'separate', skip_rows = 0,
    file_type = 'csv', sheet_index = 0, header_row = -1, notes = '',
  } = req.body as {
    institution: string; account_type: string; encoding?: string;
    column_map: object; date_format?: string; amount_sign?: string;
    skip_rows?: number; file_type?: string; sheet_index?: number;
    header_row?: number; notes?: string;
  };

  db.prepare(
    `UPDATE institution_profiles
       SET institution = ?, account_type = ?, encoding = ?, column_map = ?,
           date_format = ?, amount_sign = ?, skip_rows = ?,
           file_type = ?, sheet_index = ?, header_row = ?, notes = ?
     WHERE id = ?`
  ).run(
    institution,
    account_type,
    encoding,
    typeof column_map === 'string' ? column_map : JSON.stringify(column_map),
    date_format,
    amount_sign,
    skip_rows,
    file_type,
    sheet_index,
    header_row,
    notes,
    id,
  );

  res.json(db.prepare('SELECT * FROM institution_profiles WHERE id = ?').get(id));
});

// DELETE /api/profiles/:id — delete custom profile only
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const existing = db
    .prepare('SELECT id, is_preset FROM institution_profiles WHERE id = ?')
    .get(id) as { id: number; is_preset: number } | undefined;

  if (!existing) { res.status(404).json({ error: '프로파일을 찾을 수 없습니다.' }); return; }
  if (existing.is_preset === 1) {
    res.status(403).json({ error: '사전 등록 프로파일은 삭제할 수 없습니다.' });
    return;
  }

  db.prepare('DELETE FROM institution_profiles WHERE id = ?').run(id);
  res.status(204).end();
});

export default router;
