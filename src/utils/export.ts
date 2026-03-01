import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { BankTransaction, SecuritiesTransaction } from '../types';

function formatDate(date: string) {
  return date?.slice(0, 10) ?? '';
}

// ── Bank Transactions Export ───────────────────────────────────────────────────

export function exportBankTransactionsToCSV(rows: BankTransaction[], filename: string) {
  const header = ['날짜', '적요/거래처', '카테고리ID', '금액', '잔액', '메모'];
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [
        formatDate(r.date),
        `"${(r.payee ?? '').replace(/"/g, '""')}"`,
        r.category_id ?? '',
        r.amount,
        r.balance,
        `"${(r.note ?? '').replace(/"/g, '""')}"`,
      ].join(',')
    ),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, filename);
}

export function exportBankTransactionsToExcel(rows: BankTransaction[], filename: string) {
  const wsData = [
    ['날짜', '적요/거래처', '카테고리ID', '금액', '잔액', '메모'],
    ...rows.map((r) => [
      formatDate(r.date),
      r.payee ?? '',
      r.category_id ?? '',
      r.amount,
      r.balance,
      r.note ?? '',
    ]),
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, '거래내역');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), filename);
}

// ── Securities Transactions Export ────────────────────────────────────────────

export function exportSecuritiesTransactionsToCSV(rows: SecuritiesTransaction[], filename: string) {
  const header = ['날짜', '구분', '종목명', '종목코드', '거래내용', '금액', '잔고'];
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [
        formatDate(r.date),
        `"${(r.type ?? '').replace(/"/g, '""')}"`,
        `"${(r.security ?? '').replace(/"/g, '""')}"`,
        r.security_code ?? '',
        `"${(r.description ?? '').replace(/"/g, '""')}"`,
        r.amount,
        r.balance,
      ].join(',')
    ),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, filename);
}

export function exportSecuritiesTransactionsToExcel(
  rows: SecuritiesTransaction[],
  filename: string
) {
  const wsData = [
    ['날짜', '구분', '종목명', '종목코드', '거래내용', '금액', '잔고'],
    ...rows.map((r) => [
      formatDate(r.date),
      r.type ?? '',
      r.security ?? '',
      r.security_code ?? '',
      r.description ?? '',
      r.amount,
      r.balance,
    ]),
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, '거래내역');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), filename);
}
