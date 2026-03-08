import { Router, Request, Response } from 'express';
import multer from 'multer';
import { getDb } from '../db';
import {
  parseFileToRawRows,
  applyBankColumnMap,
  applySecuritiesColumnMap,
  type BankColumnMap,
  type SecuritiesColumnMap,
} from '../utils/parser';
import { getSheetInfos, parseExcelSheet } from '../utils/xlsParser';
import { parsePdfAdvanced } from '../utils/pdfParser';
import { detectAndDecode } from '../utils/encoding';
import { computeImportHash } from '../utils/hash';
import { recalculateBankBalance } from './transactions';
import { recalculateHoldings } from '../services/holdingsEngine';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

interface InstitutionProfileRow {
  id: number;
  institution: string;
  account_type: string;
  encoding: string;
  column_map: string;
  date_format: string;
  amount_sign: string;
  skip_rows: number;
  is_preset: number;
  file_type: string;
  sheet_index: number;
  header_row: number;
  notes: string;
}

function getFileExt(filename: string): string {
  return (filename.split('.').pop() ?? '').toLowerCase();
}

function isExcel(filename: string): boolean {
  const ext = getFileExt(filename);
  return ext === 'xls' || ext === 'xlsx';
}

// ── POST /api/import/sheets ────────────────────────────────────────────────────
router.post('/sheets', upload.single('file'), (req: Request, res: Response) => {
  const file = req.file;
  if (!file) { res.status(400).json({ error: '파일이 없습니다.' }); return; }
  if (!isExcel(file.originalname)) {
    res.status(400).json({ error: 'XLS/XLSX 파일만 지원합니다.' });
    return;
  }
  try {
    const infos = getSheetInfos(file.buffer);
    res.json({ sheets: infos });
  } catch (err) {
    res.status(500).json({ error: `시트 읽기 오류: ${(err as Error).message}` });
  }
});

// ── POST /api/import/preview ───────────────────────────────────────────────────
router.post('/preview', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ error: '파일이 없습니다.' }); return; }

    const accountId   = Number(req.body.account_id);
    const accountType = req.body.account_type as string;
    const institution = (req.body.institution ?? '') as string;
    const columnMappingStr = req.body.column_mapping as string | undefined;
    const amountSign  = (req.body.amount_sign ?? 'separate') as string;
    const encoding    = (req.body.encoding ?? 'auto') as string;
    const skipRows    = Number(req.body.skip_rows ?? 0);
    const sheetIndex  = Number(req.body.sheet_index ?? 0);
    const headerRow   = Number(req.body.header_row ?? -1);

    const db = getDb();
    const ext = getFileExt(file.originalname);

    // Look up profile: prefer file-type-specific match (e.g. 'xls' over 'csv')
    let profile: InstitutionProfileRow | undefined;
    if (institution && institution !== '직접 입력') {
      profile = db
        .prepare(`SELECT * FROM institution_profiles WHERE institution = ? AND account_type = ? AND file_type = ? LIMIT 1`)
        .get(institution, accountType, ext) as InstitutionProfileRow | undefined;
      if (!profile) {
        profile = db
          .prepare(`SELECT * FROM institution_profiles WHERE institution = ? AND account_type = ? LIMIT 1`)
          .get(institution, accountType) as InstitutionProfileRow | undefined;
      }
    }

    const effectiveEncoding  = profile?.encoding ?? encoding;
    const effectiveSkipRows  = profile?.skip_rows ?? skipRows;
    // User-provided sheetIndex always wins — profile.sheet_index is 0 by default
    // which would incorrectly override the user's explicit sheet selection via ??
    const effectiveSheet     = sheetIndex;
    const effectiveHeaderRow = profile?.header_row ?? headerRow;

    // Extract column_map values so the XLS parser can locate the header row by
    // matching against known column label strings (e.g. "거래일자", "거래금액").
    let knownHeaderValues: string[] | undefined;
    const cmSource = profile?.column_map ?? columnMappingStr;
    if (cmSource) {
      try {
        const cm = JSON.parse(cmSource) as Record<string, unknown>;
        knownHeaderValues = Object.values(cm).filter(
          (v): v is string => typeof v === 'string' && v.length > 0
        );
      } catch { /* ignore */ }
    }

    // Parse file into raw rows
    let headers: string[];
    let rows: Record<string, string>[];
    let detectedEncoding = effectiveEncoding;

    if (ext === 'xls' || ext === 'xlsx') {
      const result = parseExcelSheet(file.buffer, effectiveSheet, effectiveHeaderRow, knownHeaderValues);
      headers = result.headers;
      rows = result.rows;
      detectedEncoding = 'Excel (내장 인코딩)';
    } else if (ext === 'pdf') {
      const result = await parsePdfAdvanced(file.buffer);
      headers = result.headers;
      rows = result.rows;
      detectedEncoding = 'PDF (텍스트 추출)';
    } else {
      // CSV — auto-detect or use specified encoding
      if (effectiveEncoding === 'auto' || effectiveEncoding === 'utf-8') {
        const { text, detected } = detectAndDecode(file.buffer);
        detectedEncoding = detected;
        // Re-use parseCsv via parseFileToRawRows but pass the decoded text as utf-8
        const decoded = Buffer.from(text, 'utf-8');
        const result = await parseFileToRawRows(decoded, file.originalname.replace(/\.csv$/i, '.csv'), 'utf-8', effectiveSkipRows);
        headers = result.headers;
        rows = result.rows;
      } else {
        const result = await parseFileToRawRows(file.buffer, file.originalname, effectiveEncoding, effectiveSkipRows);
        headers = result.headers;
        rows = result.rows;
        detectedEncoding = effectiveEncoding;
      }
    }

    // If no profile and no column_mapping provided → return headers for mapping UI
    if (!profile && !columnMappingStr) {
      res.json({
        needsMapping: true,
        headers,
        sampleRows: rows.slice(0, 10),
        profileMatch: null,
        detectedEncoding,
      });
      return;
    }

    // Resolve column map
    let columnMap: BankColumnMap | SecuritiesColumnMap;
    let effectiveAmountSign = amountSign;

    if (profile) {
      columnMap = JSON.parse(profile.column_map) as BankColumnMap | SecuritiesColumnMap;
      effectiveAmountSign = profile.amount_sign;
    } else {
      columnMap = JSON.parse(columnMappingStr!) as BankColumnMap | SecuritiesColumnMap;
    }

    // Apply column map
    let mappedRows: Array<{ import_hash: string; isDuplicate: boolean; [key: string]: unknown }>;
    let skippedCount = 0;

    if (accountType === 'bank') {
      const bankMap = columnMap as BankColumnMap;
      const bankRows = applyBankColumnMap(rows, bankMap, effectiveAmountSign);
      skippedCount = rows.length - bankRows.length;
      const existingHashes = new Set(
        (db
          .prepare('SELECT import_hash FROM bank_transactions WHERE account_id = ? AND import_hash IS NOT NULL')
          .all(accountId) as { import_hash: string }[])
          .map((r) => r.import_hash)
      );
      mappedRows = bankRows.map((r) => {
        const hash = computeImportHash(accountId, r.date, r.amount, r.payee);
        return { ...r, import_hash: hash, isDuplicate: existingHashes.has(hash) };
      });
    } else {
      const secMap = columnMap as SecuritiesColumnMap;
      const secRows = applySecuritiesColumnMap(rows, secMap);
      skippedCount = rows.length - secRows.length;
      const existingHashes = new Set(
        (db
          .prepare('SELECT import_hash FROM securities_transactions WHERE account_id = ? AND import_hash IS NOT NULL')
          .all(accountId) as { import_hash: string }[])
          .map((r) => r.import_hash)
      );
      mappedRows = secRows.map((r) => {
        const hash = computeImportHash(accountId, r.date, r.amount, r.security + r.type);
        return { ...r, import_hash: hash, isDuplicate: existingHashes.has(hash) };
      });
    }

    const newRows = mappedRows.filter((r) => !r.isDuplicate);
    res.json({
      needsMapping: false,
      headers,
      sampleRows: rows.slice(0, 10),
      rows: mappedRows,
      total: mappedRows.length,
      newCount: newRows.length,
      duplicateCount: mappedRows.length - newRows.length,
      skippedCount,
      profileMatch: profile ? { institution: profile.institution, profileId: profile.id } : null,
      detectedEncoding,
    });
  } catch (err) {
    console.error('Import preview error:', err);
    res.status(500).json({ error: `파싱 오류: ${(err as Error).message}` });
  }
});

// ── POST /api/import/confirm ───────────────────────────────────────────────────
router.post('/confirm', (req: Request, res: Response) => {
  const {
    account_id, account_type, rows,
    filename = '', institution = '', total_rows = 0, duplicate_rows = 0, skipped_rows = 0,
  } = req.body as {
    account_id: number;
    account_type: string;
    rows: Array<Record<string, unknown>>;
    filename?: string;
    institution?: string;
    total_rows?: number;
    duplicate_rows?: number;
    skipped_rows?: number;
  };

  if (!account_id || !account_type || !Array.isArray(rows)) {
    res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
    return;
  }

  const db = getDb();
  let saved = 0;
  const fileExt = filename ? getFileExt(filename) : 'csv';

  try {
    if (account_type === 'bank') {
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO bank_transactions
           (account_id, date, payee, amount, balance, note, import_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      db.exec('BEGIN');
      try {
        for (const row of rows) {
          const result = stmt.run(
            account_id,
            row.date as string,
            (row.payee as string) ?? '',
            Number(row.amount),
            Number(row.balance ?? 0),
            (row.note as string) ?? '',
            (row.import_hash as string) ?? null
          );
          saved += Number(result.changes);
        }
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      recalculateBankBalance(Number(account_id));
    } else if (account_type === 'securities') {
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO securities_transactions
           (account_id, date, type, security, security_code, description,
            amount, balance, quantity, unit_price, foreign_amount, foreign_currency, import_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      db.exec('BEGIN');
      try {
        for (const row of rows) {
          const result = stmt.run(
            account_id,
            row.date as string,
            (row.type as string) ?? '기타',
            (row.security as string) ?? '',
            (row.security_code as string) ?? '',
            (row.description as string) ?? '',
            Number(row.amount),
            Number(row.balance ?? 0),
            Number(row.quantity ?? 0),
            Number(row.unit_price ?? 0),
            Number(row.foreign_amount ?? 0),
            (row.foreign_currency as string) ?? '',
            (row.import_hash as string) ?? null
          );
          saved += Number(result.changes);
        }
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      // 증권 대량 import 후 holdings 재계산
      if (saved > 0) recalculateHoldings(Number(account_id));
    }

    // Record import history
    const status = saved === rows.length ? 'success' : saved === 0 ? 'failed' : 'partial';
    db.prepare(
      `INSERT INTO import_history
         (account_id, filename, institution, file_type, total_rows, imported_rows, duplicate_rows, skipped_rows, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      account_id,
      filename || '(알 수 없음)',
      institution || '(알 수 없음)',
      fileExt,
      Number(total_rows),
      saved,
      Number(duplicate_rows),
      Number(skipped_rows),
      status,
    );

    res.json({ saved, duplicates: rows.length - saved });
  } catch (err) {
    // Record failed history
    try {
      db.prepare(
        `INSERT INTO import_history
           (account_id, filename, institution, file_type, total_rows, imported_rows, duplicate_rows, skipped_rows, status, error_message)
         VALUES (?, ?, ?, ?, ?, 0, 0, 0, 'failed', ?)`
      ).run(
        account_id,
        filename || '(알 수 없음)',
        institution || '(알 수 없음)',
        fileExt,
        Number(total_rows),
        (err as Error).message,
      );
    } catch { /* ignore history insert failure */ }
    throw err;
  }
});

// ── GET /api/import/history ────────────────────────────────────────────────────
router.get('/history', (req: Request, res: Response) => {
  const db = getDb();
  const accountId = req.query.account_id ? Number(req.query.account_id) : null;
  const history = accountId
    ? db.prepare('SELECT * FROM import_history WHERE account_id = ? ORDER BY imported_at DESC').all(accountId)
    : db.prepare('SELECT * FROM import_history ORDER BY imported_at DESC').all();
  res.json(history);
});

// ── DELETE /api/import/history/:id ────────────────────────────────────────────
router.delete('/history/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM import_history WHERE id = ?').run(Number(req.params.id));
  res.status(204).end();
});

export default router;
