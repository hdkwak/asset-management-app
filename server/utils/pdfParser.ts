import type { ParseResult, RawRow } from './parser';

const DATE_PATTERNS = [
  /\d{4}[.\-\/]\d{2}[.\-\/]\d{2}/,   // 2026.02.01 / 2026-02-01 / 2026/02/01
  /\d{4}\d{2}\d{2}/,                   // 20260201
  /\d{2}[.\-\/]\d{2}[.\-\/]\d{2}/,    // 26.02.01
];

const AMOUNT_PATTERN = /[\d,]{3,}(?:\.\d{2})?/g;

function containsDate(cell: string): boolean {
  return DATE_PATTERNS.some((p) => p.test(cell));
}

function splitLine(line: string): string[] {
  return line
    .split(/\t|\s{2,}/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

function tryTableParse(lines: string[]): ParseResult | null {
  // Find the header line: first line that does NOT contain a date but has 3+ cells
  let headerIdx = -1;
  let firstDataIdx = -1;

  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const cells = splitLine(lines[i]);
    if (cells.length < 3) continue;

    if (headerIdx === -1 && !containsDate(lines[i])) {
      headerIdx = i;
      continue;
    }

    if (headerIdx !== -1 && containsDate(lines[i])) {
      firstDataIdx = i;
      break;
    }
  }

  // If we cannot find a clear header + data structure, bail out
  if (headerIdx === -1 || firstDataIdx === -1) return null;

  const headers = splitLine(lines[headerIdx]);
  const rows: RawRow[] = [];

  for (let i = firstDataIdx; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    if (cells.length === 0) continue;
    if (!containsDate(cells[0] ?? '')) continue;

    const row: RawRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cells[j] ?? '';
    }
    rows.push(row);
  }

  if (rows.length === 0) return null;
  return { headers, rows };
}

function tryLineParse(lines: string[]): ParseResult {
  // Heuristic: any line that starts with a date pattern is a transaction row.
  // Extract date, description, amounts from that line (or next line if 2-line layout).
  const syntheticHeaders = ['날짜', '내용', '출금', '입금', '잔액'];
  const rows: RawRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = DATE_PATTERNS.map((p) => p.exec(line)).find((m) => m !== null);
    if (!dateMatch) continue;

    const date = dateMatch[0].replace(/[.\-\/]/g, '-');
    // Normalize 8-digit date: 20260201 → 2026-02-01
    const normalizedDate =
      date.length === 8
        ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
        : date.length === 6 && !date.includes('-')
        ? `20${date.slice(0, 2)}-${date.slice(2, 4)}-${date.slice(4, 6)}`
        : date;

    // Extract amounts from this line (and optionally the next)
    const combinedText = line + ' ' + (lines[i + 1] ?? '');
    const amounts = (combinedText.match(AMOUNT_PATTERN) ?? []).map((s) =>
      parseFloat(s.replace(/,/g, ''))
    );

    // Try to extract description: text between the date and the first number
    const afterDate = line.slice(dateMatch.index + dateMatch[0].length).trim();
    const descMatch = afterDate.match(/^([^\d]+)/);
    const content = descMatch ? descMatch[1].trim() : '';

    const row: RawRow = {
      날짜: normalizedDate,
      내용: content,
      출금: amounts[0] != null && amounts[0] > 0 && amounts.length >= 2 ? String(amounts[0]) : '',
      입금: amounts[0] != null && amounts.length === 1 ? String(amounts[0]) : '',
      잔액: amounts.length >= 2 ? String(amounts[amounts.length - 1]) : '',
    };

    rows.push(row);
  }

  return { headers: syntheticHeaders, rows };
}

/**
 * Parse a PDF buffer into rows using two strategies:
 * 1. Structured table parse (detect header + data rows)
 * 2. Line-based date-pattern parse
 */
export async function parsePdfAdvanced(buffer: Buffer): Promise<ParseResult> {
  // Dynamic require to avoid pdf-parse's test-file side-effect at import time
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
  const { text } = await pdfParse(buffer);

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { headers: [], rows: [] };

  // Strategy 1: table parse
  const tableResult = tryTableParse(lines);
  if (tableResult && tableResult.rows.length > 0) return tableResult;

  // Strategy 2: line-based parse
  return tryLineParse(lines);
}
