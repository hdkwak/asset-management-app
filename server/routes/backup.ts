import { Router, Request, Response } from 'express';
import { getDb } from '../db';

const router = Router();

// ── POST /api/backup/export ────────────────────────────────────────────────────
router.post('/export', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      accounts: db.prepare('SELECT * FROM accounts').all(),
      categories: db.prepare('SELECT * FROM categories').all(),
      bank_transactions: db.prepare('SELECT * FROM bank_transactions').all(),
      securities_transactions: db.prepare('SELECT * FROM securities_transactions').all(),
      institution_profiles: db
        .prepare('SELECT * FROM institution_profiles WHERE is_preset = 0')
        .all(),
    };
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: `백업 실패: ${(err as Error).message}` });
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function s(v: unknown): string   { return (v ?? '') as string; }
function n(v: unknown): number   { return Number(v ?? 0); }
function ns(v: unknown): string | null { return v == null ? null : String(v); }

// ── POST /api/backup/import ────────────────────────────────────────────────────
router.post('/import', (req: Request, res: Response) => {
  try {
    const data = req.body as {
      version: number;
      accounts?: Record<string, unknown>[];
      categories?: Record<string, unknown>[];
      bank_transactions?: Record<string, unknown>[];
      securities_transactions?: Record<string, unknown>[];
      institution_profiles?: Record<string, unknown>[];
    };

    if (!data || data.version !== 1) {
      res.status(400).json({ error: '잘못된 백업 파일 형식입니다.' });
      return;
    }

    const db = getDb();
    const stats = { accounts: 0, categories: 0, bankTx: 0, securitiesTx: 0, profiles: 0 };

    db.exec('BEGIN');
    try {
      // Restore categories (UPSERT by id)
      if (data.categories?.length) {
        const stmt = db.prepare(
          'INSERT OR REPLACE INTO categories (id, name, color, is_income, icon) VALUES (?, ?, ?, ?, ?)'
        );
        for (const cat of data.categories) {
          stmt.run(n(cat.id), s(cat.name), s(cat.color), n(cat.is_income), s(cat.icon) || 'tag');
          stats.categories++;
        }
      }

      // Restore accounts
      if (data.accounts?.length) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO accounts
            (id, name, institution, type, account_number, color, balance, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const acc of data.accounts) {
          stmt.run(
            n(acc.id), s(acc.name), s(acc.institution), s(acc.type), ns(acc.account_number),
            s(acc.color), n(acc.balance), s(acc.created_at), s(acc.updated_at)
          );
          stats.accounts++;
        }
      }

      // Restore bank_transactions
      if (data.bank_transactions?.length) {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO bank_transactions
            (id, account_id, date, payee, category_id, amount, balance, note, import_hash, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const tx of data.bank_transactions) {
          const r = stmt.run(
            n(tx.id), n(tx.account_id), s(tx.date), s(tx.payee),
            tx.category_id == null ? null : n(tx.category_id),
            n(tx.amount), n(tx.balance), s(tx.note), ns(tx.import_hash),
            s(tx.created_at), s(tx.updated_at)
          );
          if (Number(r.changes) > 0) stats.bankTx++;
        }
      }

      // Restore securities_transactions
      if (data.securities_transactions?.length) {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO securities_transactions
            (id, account_id, date, type, security, security_code, description, amount, balance, import_hash, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const tx of data.securities_transactions) {
          const r = stmt.run(
            n(tx.id), n(tx.account_id), s(tx.date), s(tx.type) || '기타',
            s(tx.security), s(tx.security_code), s(tx.description),
            n(tx.amount), n(tx.balance), ns(tx.import_hash),
            s(tx.created_at), s(tx.updated_at)
          );
          if (Number(r.changes) > 0) stats.securitiesTx++;
        }
      }

      // Restore user-created profiles (force is_preset = 0)
      if (data.institution_profiles?.length) {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO institution_profiles
            (id, institution, account_type, encoding, column_map, date_format, amount_sign,
             skip_rows, is_preset, file_type, sheet_index, header_row, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
        `);
        for (const p of data.institution_profiles) {
          stmt.run(
            n(p.id), s(p.institution), s(p.account_type), s(p.encoding) || 'utf-8', s(p.column_map),
            s(p.date_format) || 'YYYY-MM-DD', s(p.amount_sign) || 'separate',
            n(p.skip_rows), s(p.file_type) || 'csv', n(p.sheet_index),
            n(p.header_row) || -1, s(p.notes)
          );
          stats.profiles++;
        }
      }

      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ error: `복원 실패: ${(err as Error).message}` });
  }
});

export default router;
