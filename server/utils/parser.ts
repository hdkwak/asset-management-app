import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import iconv from 'iconv-lite';

export interface RawRow {
  [key: string]: string;
}

export interface ParseResult {
  headers: string[];
  rows: RawRow[];
}

export interface BankColumnMap {
  date: string;
  payee?: string;
  amount?: string;       // signed amount column
  amount_in?: string;    // income column (separate mode)
  amount_out?: string;   // expense column (separate mode)
  balance?: string;      // balance after transaction
  note?: string;
}

export interface SecuritiesColumnMap {
  date: string;
  type?: string;
  security?: string;
  security_code?: string;
  description?: string;
  amount?: string;       // signed amount column
  amount_in?: string;    // income/credit column (separate mode)
  amount_out?: string;   // expense/debit column (separate mode)
  balance?: string;
  quantity?: string;    // 수량 (거래수량, 체결수량 등)
  unit_price?: string;  // 단가 (체결단가, 매매단가 등)
}

export interface MappedBankRow {
  date: string;
  payee: string;
  amount: number;
  balance: number;
  note: string;
}

export interface MappedSecuritiesRow {
  date: string;
  type: string;
  security: string;
  security_code: string;
  description: string;
  amount: number;
  balance: number;
  quantity: number;
  unit_price: number;
}

// ── File parsing ─────────────────────────────────────────────────────────────

export async function parseFileToRawRows(
  buffer: Buffer,
  filename: string,
  encoding = 'utf-8',
  skipRows = 0
): Promise<ParseResult> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'csv') return parseCsv(buffer, encoding, skipRows);
  if (ext === 'xls' || ext === 'xlsx') return parseExcel(buffer, skipRows);
  if (ext === 'pdf') return parsePdf(buffer);

  throw new Error(`지원하지 않는 파일 형식입니다: .${ext}`);
}

function parseCsv(buffer: Buffer, encoding: string, skipRows: number): ParseResult {
  let text: string;
  if (encoding === 'euc-kr') {
    text = iconv.decode(buffer, 'euc-kr');
  } else {
    // Strip BOM if present
    text = buffer.toString('utf-8').replace(/^\uFEFF/, '');
  }

  const lines = text.split(/\r?\n/);
  const relevant = lines.slice(skipRows).join('\n');

  const result = Papa.parse<Record<string, string>>(relevant, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  const headers = (result.meta.fields ?? []).map((h) => h.trim());
  const rows = (result.data as Record<string, string>[]).map((row) => {
    const out: RawRow = {};
    for (const h of headers) out[h] = (row[h] ?? '').toString().trim();
    return out;
  });

  return { headers, rows };
}

function parseExcel(buffer: Buffer, skipRows: number): ParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer', raw: false });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];

  const allRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false });

  const headerRowIdx = skipRows;
  if (allRows.length <= headerRowIdx) return { headers: [], rows: [] };

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
      row[headers[j]] = val;
      if (val) hasData = true;
    }
    if (hasData) rows.push(row);
  }

  return { headers, rows };
}

async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  // Dynamic require avoids pdf-parse's test-file side-effect at import time
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
  const { text } = await pdfParse(buffer);

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { headers: [], rows: [] };

  // Attempt to split by tabs or 2+ spaces
  const split = (line: string) =>
    line.split(/\t|\s{2,}/).map((c) => c.trim()).filter((c) => c.length > 0);

  const headers = split(lines[0]);
  const rows: RawRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = split(lines[i]);
    if (cells.length === 0) continue;
    const row: RawRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cells[j] ?? '';
    }
    rows.push(row);
  }

  return { headers, rows };
}

// ── Date / Amount normalization ───────────────────────────────────────────────

export function normalizeDate(s: string): string {
  if (!s) return '';
  // Strip time component
  const datePart = s.trim().split(/[\sT]/)[0];
  const digits = datePart.replace(/\D/g, '');

  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }

  const segs = datePart.split(/[-/.]/);
  if (segs.length === 3) {
    const [a, b, c] = segs;
    const aNum = parseInt(a), bNum = parseInt(b), cNum = parseInt(c);

    // 4-digit year first → unambiguous Y/M/D
    if (a.length === 4) {
      return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    }

    // If c is a 2-digit number ≥ 10 it likely represents a year (e.g. 25 → 2025).
    // Korean financial files (e.g. 미래에셋 XLS) use M/D/YY or D/M/YY format.
    if (c.length === 2 && cNum >= 10) {
      const y = `20${c}`;
      if (aNum >= 1 && aNum <= 12 && bNum >= 1 && bNum <= 31) {
        // M/D/YY  e.g. 12/5/25 → 2025-12-05,  10/30/25 → 2025-10-30
        return `${y}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
      }
      if (bNum >= 1 && bNum <= 12 && aNum >= 1 && aNum <= 31) {
        // D/M/YY  e.g. 25/12/05 (already handled above by 4-digit check, but just in case)
        return `${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
      }
    }

    // Standard YY/MM/DD or Y/M/D with 2-digit year prefix
    const y = a.length === 2 ? `20${a}` : a;
    return `${y}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
  }

  return datePart;
}

export function normalizeAmount(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/[^0-9.\-]/g, '');
  if (!cleaned || cleaned === '-') return 0;
  return parseFloat(cleaned) || 0;
}

// ── Column mapping ────────────────────────────────────────────────────────────

export function applyBankColumnMap(
  rows: RawRow[],
  map: BankColumnMap,
  amountSign: string
): MappedBankRow[] {
  return rows
    .map((row) => {
      const date = normalizeDate(row[map.date] ?? '');
      const payee = (row[map.payee ?? ''] ?? '').trim();
      const note = (row[map.note ?? ''] ?? '').trim();

      let amount: number;
      if (amountSign === 'separate' && map.amount_in && map.amount_out) {
        const income = normalizeAmount(row[map.amount_in] ?? '');
        const expense = normalizeAmount(row[map.amount_out] ?? '');
        if (income > 0) amount = income;
        else if (expense > 0) amount = -expense;
        else amount = 0;
      } else {
        amount = normalizeAmount(row[map.amount ?? ''] ?? '');
      }

      const balanceRaw = map.balance ? (row[map.balance] ?? '') : '';
      const balance = balanceRaw
        ? parseFloat(String(balanceRaw).replace(/[,₩\s원]/g, '')) || 0
        : 0;

      return { date, payee, amount, balance, note };
    })
    .filter((r) => r.date !== '' && r.amount !== 0);
}

export function applySecuritiesColumnMap(
  rows: RawRow[],
  map: SecuritiesColumnMap
): MappedSecuritiesRow[] {
  return rows
    .map((row) => {
      const security = (row[map.security ?? ''] ?? '').trim();
      const rawCode  = map.security_code ? (row[map.security_code] ?? '').trim() : '';
      // security_code 컬럼이 없으면 종목명을 그룹핑 키로 사용
      const securityCode = rawCode || security;

      // 입금/출금 분리 컬럼 또는 단일 부호 컬럼 지원
      let amount: number;
      if (map.amount_in || map.amount_out) {
        const income  = normalizeAmount(row[map.amount_in  ?? ''] ?? '');
        const expense = normalizeAmount(row[map.amount_out ?? ''] ?? '');
        if (income > 0) amount = income;
        else if (expense > 0) amount = -expense;
        else amount = 0;
      } else {
        amount = normalizeAmount(row[map.amount ?? ''] ?? '');
      }

      return {
        date:          normalizeDate(row[map.date] ?? ''),
        type:          (row[map.type ?? ''] ?? '기타').trim() || '기타',
        security,
        security_code: securityCode,
        description:   (row[map.description ?? ''] ?? '').trim(),
        amount,
        balance:       normalizeAmount(row[map.balance ?? ''] ?? ''),
        quantity:      normalizeAmount(row[map.quantity ?? ''] ?? ''),
        unit_price:    normalizeAmount(row[map.unit_price ?? ''] ?? ''),
      };
    })
    .filter((r) => r.date !== '');
}
