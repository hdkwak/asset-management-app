import * as XLSX from 'xlsx';
import type { ParseResult, RawRow } from './parser';

export interface SheetInfo {
  name: string;
  rowCount: number;
}

/**
 * Return the list of sheets in an XLS/XLSX file along with row counts.
 */
export function getSheetInfos(buffer: Buffer): SheetInfo[] {
  const wb = XLSX.read(buffer, { type: 'buffer', raw: false });
  return wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1');
    const rowCount = range.e.r - range.s.r + 1;
    return { name, rowCount };
  });
}

/**
 * Detect the header row index by finding the first row where <50% of cells
 * are purely numeric and the row has at least 3 non-empty cells.
 */
export function detectHeaderRow(rows: (string | undefined)[][]): number {
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i].map((c) => (c ?? '').toString().trim()).filter((c) => c.length > 0);
    if (row.length < 3) continue;
    const numericCount = row.filter((cell) => {
      const n = Number(cell.replace(/[,₩\s원]/g, ''));
      return !isNaN(n) && cell.length > 0;
    }).length;
    const ratio = numericCount / row.length;
    if (ratio < 0.5) return i;
  }
  return 0;
}

/**
 * Parse a specific sheet from an XLS/XLSX buffer.
 * If headerRow is -1 (auto), detectHeaderRow() is used.
 */
export function parseExcelSheet(
  buffer: Buffer,
  sheetIndex = 0,
  headerRow = -1
): ParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer', raw: false });
  const sheetName = wb.SheetNames[sheetIndex] ?? wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];

  const allRows = XLSX.utils.sheet_to_json<(string | undefined)[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  if (allRows.length === 0) return { headers: [], rows: [] };

  const headerRowIdx = headerRow >= 0 ? headerRow : detectHeaderRow(allRows);
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
