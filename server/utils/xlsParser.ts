import * as XLSX from 'xlsx';
import type { ParseResult, RawRow } from './parser';

export interface SheetInfo {
  name: string;
  rowCount: number;
}

// ── HTML-disguised-as-XLS support ────────────────────────────────────────────
// Some Korean banks (e.g. KB국민은행) export transaction history as an HTML
// file saved with a .xls extension. XLSX cannot parse these, so we detect and
// handle them separately.

function isHtmlBuffer(buffer: Buffer): boolean {
  const preview = buffer.slice(0, 500).toString('utf-8');
  return /<meta|<html|<!DOCTYPE/i.test(preview);
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract all <tr> rows (with <td> cells) from an HTML string. */
function parseHtmlTableRows(html: string): string[][] {
  const allRows: string[][] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRegex.exec(html)) !== null) {
    const cells: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
      cells.push(stripHtml(tdMatch[1]));
    }
    if (cells.length > 0) allRows.push(cells);
  }
  return allRows;
}

/**
 * Return the list of sheets in an XLS/XLSX file along with row counts.
 */
export function getSheetInfos(buffer: Buffer): SheetInfo[] {
  if (isHtmlBuffer(buffer)) {
    const rows = parseHtmlTableRows(buffer.toString('utf-8'));
    return [{ name: 'Sheet1', rowCount: rows.length }];
  }
  const wb = XLSX.read(buffer, { type: 'buffer', raw: false });
  return wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1');
    const rowCount = range.e.r - range.s.r + 1;
    return { name, rowCount };
  });
}

/**
 * Detect the header row index within the first 15 rows.
 *
 * Strategy: bank export files often have preamble rows (title, account info)
 * before the actual column header row. The header row has the most non-empty
 * cells (all column labels filled in), while preamble rows only fill a few
 * cells. So we find the maximum non-empty cell count, then return the first
 * row that achieves that maximum AND has <50% purely-numeric cells.
 */
export function detectHeaderRow(rows: (string | undefined)[][]): number {
  const window = Math.min(15, rows.length);

  const stats = Array.from({ length: window }, (_, i) => {
    const cells = rows[i].map((c) => (c ?? '').toString().trim()).filter((c) => c.length > 0);
    const numericCount = cells.filter((cell) => {
      const n = Number(cell.replace(/[,₩\s원]/g, ''));
      return !isNaN(n) && cell.length > 0;
    }).length;
    return { idx: i, nonEmpty: cells.length, numericCount };
  });

  const maxNonEmpty = Math.max(...stats.map((s) => s.nonEmpty));

  // Primary: first row with max non-empty cells and mostly text labels
  for (const s of stats) {
    if (s.nonEmpty === maxNonEmpty && s.nonEmpty >= 3 && s.numericCount / s.nonEmpty < 0.5) {
      return s.idx;
    }
  }

  // Fallback: first row with ≥3 non-empty cells and <50% numeric (original behaviour)
  for (const s of stats) {
    if (s.nonEmpty >= 3 && s.numericCount / s.nonEmpty < 0.5) {
      return s.idx;
    }
  }

  return 0;
}

/**
 * Parse a specific sheet from an XLS/XLSX buffer.
 * If headerRow is -1 (auto), detectHeaderRow() is used.
 * HTML-disguised XLS files are handled via a built-in HTML table parser.
 */
export function parseExcelSheet(
  buffer: Buffer,
  sheetIndex = 0,
  headerRow = -1
): ParseResult {
  let allRows: (string | undefined)[][];
  let effectiveHeaderRow = headerRow;

  if (isHtmlBuffer(buffer)) {
    allRows = parseHtmlTableRows(buffer.toString('utf-8')) as string[][];
    // HTML XLS files often have multi-row preambles (account info, etc.).
    // Find the header as the first row with the maximum cell count, which
    // corresponds to the actual transaction table columns.
    if (effectiveHeaderRow < 0 && allRows.length > 0) {
      const maxCells = Math.max(...allRows.map((r) => r.length));
      const idx = allRows.findIndex((r) => r.length === maxCells);
      effectiveHeaderRow = idx >= 0 ? idx : 0;
    }
  } else {
    const wb = XLSX.read(buffer, { type: 'buffer', raw: false });
    const sheetName = wb.SheetNames[sheetIndex] ?? wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    allRows = XLSX.utils.sheet_to_json<(string | undefined)[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
    });
  }

  if (allRows.length === 0) return { headers: [], rows: [] };

  const headerRowIdx = effectiveHeaderRow >= 0 ? effectiveHeaderRow : detectHeaderRow(allRows);
  if (headerRowIdx >= allRows.length) return { headers: [], rows: [] };

  const headers = (allRows[headerRowIdx] as (string | undefined)[]).map((h) =>
    (h ?? '').toString().trim()
  );

  const rows: RawRow[] = [];
  for (let i = headerRowIdx + 1; i < allRows.length; i++) {
    const cells = allRows[i] as (string | undefined)[];
    const row: RawRow = {};
    let hasData = false;
    for (let j = 0; j < headers.length; j++) {
      const val = (cells[j] ?? '').toString().trim();
      if (headers[j]) row[headers[j]] = val;
      if (val) hasData = true;
    }
    if (hasData) rows.push(row);
  }

  return { headers: headers.filter(Boolean), rows };
}
