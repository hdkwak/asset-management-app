import { DatabaseSync } from 'node:sqlite';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'asset-manager.db');

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    initSchema(db);
  }
  return db;
}

function initSchema(database: DatabaseSync): void {
  // ── Core tables ─────────────────────────────────────────────────────────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      institution    TEXT NOT NULL,
      type           TEXT NOT NULL CHECK(type IN ('bank', 'securities')),
      account_number TEXT,
      color          TEXT DEFAULT '#4F86C6',
      balance        REAL DEFAULT 0,
      created_at     TEXT DEFAULT (datetime('now')),
      updated_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL UNIQUE,
      color     TEXT DEFAULT '#888888',
      is_income INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bank_transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      date        TEXT NOT NULL,
      payee       TEXT NOT NULL DEFAULT '',
      category_id INTEGER REFERENCES categories(id),
      amount      REAL NOT NULL,
      balance     REAL DEFAULT 0,
      note        TEXT DEFAULT '',
      import_hash TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now')),
      UNIQUE(account_id, import_hash)
    );

    CREATE TABLE IF NOT EXISTS securities_transactions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id     INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      date           TEXT NOT NULL,
      type           TEXT NOT NULL DEFAULT '기타',
      security       TEXT DEFAULT '',
      security_code  TEXT DEFAULT '',
      description    TEXT DEFAULT '',
      amount         REAL NOT NULL,
      balance        REAL DEFAULT 0,
      import_hash    TEXT,
      created_at     TEXT DEFAULT (datetime('now')),
      updated_at     TEXT DEFAULT (datetime('now')),
      UNIQUE(account_id, import_hash)
    );

    CREATE TABLE IF NOT EXISTS institution_profiles (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      institution  TEXT NOT NULL,
      account_type TEXT NOT NULL,
      encoding     TEXT DEFAULT 'utf-8',
      column_map   TEXT NOT NULL,
      date_format  TEXT DEFAULT 'YYYY-MM-DD',
      amount_sign  TEXT DEFAULT 'separate',
      skip_rows    INTEGER DEFAULT 0,
      is_preset    INTEGER DEFAULT 0,
      file_type    TEXT DEFAULT 'csv',
      sheet_index  INTEGER DEFAULT 0,
      header_row   INTEGER DEFAULT -1,
      notes        TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS import_history (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id     INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      filename       TEXT NOT NULL,
      institution    TEXT NOT NULL DEFAULT '',
      file_type      TEXT NOT NULL DEFAULT 'csv',
      total_rows     INTEGER DEFAULT 0,
      imported_rows  INTEGER DEFAULT 0,
      duplicate_rows INTEGER DEFAULT 0,
      skipped_rows   INTEGER DEFAULT 0,
      status         TEXT DEFAULT 'success',
      error_message  TEXT,
      imported_at    TEXT DEFAULT (datetime('now'))
    );
  `);

  // ── Migration: add balance column to bank_transactions if missing ──────────
  const cols = database
    .prepare('PRAGMA table_info(bank_transactions)')
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === 'balance')) {
    database.exec('ALTER TABLE bank_transactions ADD COLUMN balance REAL DEFAULT 0');
    console.log('[DB Migration] bank_transactions: balance 컬럼 추가 완료');
  }

  // ── Migration: add icon column to categories if missing ───────────────────
  const catCols = database
    .prepare('PRAGMA table_info(categories)')
    .all() as { name: string }[];
  if (!catCols.some((c) => c.name === 'icon')) {
    database.exec("ALTER TABLE categories ADD COLUMN icon TEXT DEFAULT 'tag'");
    console.log('[DB Migration] categories: icon 컬럼 추가 완료');
  }
  // Always update default category icons
  const iconMap: [string, string][] = [
    ['급여', 'briefcase'], ['이자수입', 'trending-up'], ['기타수입', 'plus-circle'],
    ['식비', 'utensils'], ['교통비', 'car'], ['쇼핑', 'shopping-bag'],
    ['의료/건강', 'heart'], ['문화/여가', 'music'], ['통신비', 'smartphone'],
    ['공과금', 'zap'], ['기타지출', 'tag'],
  ];
  for (const [name, icon] of iconMap) {
    database.prepare('UPDATE categories SET icon = ? WHERE name = ?').run(icon, name);
  }

  // ── Migration: institution_profiles new columns ───────────────────────────
  const profileCols = database
    .prepare('PRAGMA table_info(institution_profiles)')
    .all() as { name: string }[];
  const profileMigrations: Record<string, string> = {
    file_type:   "ALTER TABLE institution_profiles ADD COLUMN file_type TEXT DEFAULT 'csv'",
    sheet_index: 'ALTER TABLE institution_profiles ADD COLUMN sheet_index INTEGER DEFAULT 0',
    header_row:  'ALTER TABLE institution_profiles ADD COLUMN header_row INTEGER DEFAULT -1',
    notes:       "ALTER TABLE institution_profiles ADD COLUMN notes TEXT DEFAULT ''",
  };
  for (const [col, sql] of Object.entries(profileMigrations)) {
    if (!profileCols.some((c) => c.name === col)) {
      database.exec(sql);
      console.log(`[DB Migration] institution_profiles: ${col} 컬럼 추가`);
    }
  }

  // ── Seed categories ──────────────────────────────────────────────────────────
  const catCount = database
    .prepare('SELECT COUNT(*) as cnt FROM categories')
    .get() as { cnt: number };

  if (catCount.cnt === 0) {
    const insCategory = database.prepare(
      'INSERT OR IGNORE INTO categories (name, color, is_income, icon) VALUES (?, ?, ?, ?)'
    );
    database.exec('BEGIN');
    try {
      const cats: [string, string, number, string][] = [
        ['급여', '#2563EB', 1, 'briefcase'],
        ['이자수입', '#059669', 1, 'trending-up'],
        ['기타수입', '#7C3AED', 1, 'plus-circle'],
        ['식비', '#DC2626', 0, 'utensils'],
        ['교통비', '#D97706', 0, 'car'],
        ['쇼핑', '#DB2777', 0, 'shopping-bag'],
        ['의료/건강', '#065F46', 0, 'heart'],
        ['문화/여가', '#9333EA', 0, 'music'],
        ['통신비', '#1D4ED8', 0, 'smartphone'],
        ['공과금', '#92400E', 0, 'zap'],
        ['기타지출', '#6B7280', 0, 'tag'],
      ];
      for (const [name, color, is_income, icon] of cats) insCategory.run(name, color, is_income, icon);
      database.exec('COMMIT');
    } catch (e) {
      database.exec('ROLLBACK');
      throw e;
    }
  }

  // ── Upsert preset institution profiles (always update column_map) ────────────
  database.exec('BEGIN');
  try {
    const findPreset = database.prepare(
      'SELECT id FROM institution_profiles WHERE institution = ? AND account_type = ? AND is_preset = 1'
    );
    const insertProfile = database.prepare(
      `INSERT INTO institution_profiles
         (institution, account_type, encoding, column_map, amount_sign, skip_rows, is_preset)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    );
    const updateProfile = database.prepare(
      `UPDATE institution_profiles
         SET encoding = ?, column_map = ?, amount_sign = ?, skip_rows = ?
       WHERE id = ?`
    );

    function upsert(
      institution: string,
      accountType: string,
      encoding: string,
      columnMap: object,
      amountSign: string,
      skipRows = 0
    ) {
      const existing = findPreset.get(institution, accountType) as { id: number } | undefined;
      const mapStr = JSON.stringify(columnMap);
      if (existing) {
        updateProfile.run(encoding, mapStr, amountSign, skipRows, existing.id);
      } else {
        insertProfile.run(institution, accountType, encoding, mapStr, amountSign, skipRows);
      }
    }

    // ── 은행 (bank) ────────────────────────────────────────────────────────────
    upsert('KB국민은행', 'bank', 'utf-8',
      { date: '거래일시', payee: '적요', amount_in: '입금(원)', amount_out: '출금(원)', balance: '잔액' },
      'separate');
    upsert('신한은행', 'bank', 'utf-8',
      { date: '거래일자', payee: '거래내용', amount_in: '입금금액', amount_out: '출금금액', balance: '잔액', note: '메모' },
      'separate');
    upsert('하나은행', 'bank', 'utf-8',
      { date: '거래일시', payee: '거래내역', amount_in: '입금금액', amount_out: '출금금액', balance: '잔액', note: '메모' },
      'separate');
    upsert('우리은행', 'bank', 'utf-8',
      { date: '거래일자', payee: '거래내용', amount_in: '입금금액(원)', amount_out: '출금금액(원)', balance: '잔액' },
      'separate');
    upsert('NH농협은행', 'bank', 'utf-8',
      { date: '거래일시', payee: '내용', amount_in: '입금금액', amount_out: '출금금액', balance: '거래후잔액' },
      'separate');
    upsert('IBK기업은행', 'bank', 'utf-8',
      { date: '거래일자', payee: '거래내용', amount_in: '입금금액', amount_out: '출금금액', balance: '거래후잔액', note: '메모' },
      'separate');
    upsert('SC제일은행', 'bank', 'utf-8',
      { date: '날짜', payee: '거래내용', amount_in: '입금', amount_out: '출금', balance: 'Balance' },
      'separate');

    // ── 증권사 (securities) ────────────────────────────────────────────────────
    upsert('키움증권', 'securities', 'utf-8',
      { date: '일자', type: '매매구분', security: '종목명', security_code: '종목코드',
        amount: '거래금액', balance: '잔고' },
      'signed');
    upsert('미래에셋증권', 'securities', 'utf-8',
      { date: '거래일', type: '거래유형', security: '종목명', security_code: '종목코드',
        description: '거래내용', amount: '거래금액', balance: '잔고금액' },
      'signed');
    upsert('삼성증권', 'securities', 'utf-8',
      { date: '거래일자', type: '구분', security: '종목명', security_code: '종목코드',
        description: '내용', amount: '거래금액', balance: '잔고' },
      'signed');
    upsert('한국투자증권', 'securities', 'utf-8',
      { date: '거래일자', type: '거래구분', security: '종목명', security_code: '종목코드',
        description: '거래내역', amount: '금액', balance: '잔고' },
      'signed');
    upsert('NH투자증권', 'securities', 'utf-8',
      { date: '거래일자', type: '거래종류', security: '종목명', security_code: '종목코드',
        description: '거래내용', amount: '거래금액', balance: '잔고' },
      'signed');
    upsert('KB증권', 'securities', 'utf-8',
      { date: '거래일자', type: '거래구분', security: '종목명', security_code: '종목코드',
        description: '거래내용', amount: '거래금액', balance: '잔고' },
      'signed');

    database.exec('COMMIT');
  } catch (e) {
    database.exec('ROLLBACK');
    throw e;
  }
}
