import React, { useState, useRef, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown, TrendingUp, RefreshCw, ArrowRight, AlertCircle, Check, X } from 'lucide-react';
import type { Holding } from '../../types';

// ── Korean convention: up=red, down=blue ──────────────────────────────────────

function pnlColor(n: number) {
  if (n > 0) return 'text-red-600';
  if (n < 0) return 'text-blue-600';
  return 'text-gray-500';
}

function pnlSign(n: number) {
  if (n > 0) return '+';
  if (n < 0) return '';
  return '';
}

function fmtKRW(n: number) {
  return `₩${Math.abs(n).toLocaleString('ko-KR')}`;
}

function fmtRate(r: number) {
  return `${r >= 0 ? '+' : ''}${r.toFixed(2)}%`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
}

// ── TickerCell ────────────────────────────────────────────────────────────────
// Inline ticker code input: user directly types the 6-digit Naver ticker code.

interface TickerCellProps {
  holding: Holding;
  onSetTicker: (securityCode: string, tickerCode: string) => Promise<void>;
}

function TickerCell({ holding, onSetTicker }: TickerCellProps) {
  const ticker = holding.ticker_code?.trim() ?? '';
  const hasValidTicker = /^\d{6}$/.test(ticker);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setEditing(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editing]);

  const handleOpen = () => {
    setInput(ticker);
    setError('');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSave = async () => {
    const code = input.trim();
    if (!/^\d{6}$/.test(code)) {
      setError('6자리 숫자 코드를 입력하세요');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSetTicker(holding.security_code, code);
      setEditing(false);
    } catch {
      setError('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleSave();
    if (e.key === 'Escape') setEditing(false);
  };

  if (!editing) {
    return hasValidTicker ? (
      <button
        onClick={handleOpen}
        title="티커 코드 변경"
        className="text-xs text-gray-400 hover:text-blue-500 transition-colors font-mono"
      >
        {ticker}
      </button>
    ) : (
      <button
        onClick={handleOpen}
        title="시세 조회용 6자리 종목코드 입력"
        className="flex items-center gap-0.5 text-xs text-orange-500 hover:text-orange-700"
      >
        <AlertCircle size={11} />
        <span>코드 입력</span>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={handleKeyDown}
          placeholder="000000"
          maxLength={6}
          className="w-20 text-xs border border-blue-400 rounded px-1.5 py-0.5 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="p-0.5 text-blue-600 hover:text-blue-800 disabled:opacity-40"
          title="저장"
        >
          <Check size={13} />
        </button>
        <button
          onClick={() => setEditing(false)}
          className="p-0.5 text-gray-400 hover:text-gray-600"
          title="취소"
        >
          <X size={13} />
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

// ── SortHeader ────────────────────────────────────────────────────────────────

interface SortHeaderProps {
  label: string;
  col: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (col: string, order: 'asc' | 'desc') => void;
  align?: 'left' | 'right';
}

function SortHeader({ label, col, sortBy, sortOrder, onSort, align = 'right' }: SortHeaderProps) {
  const active = sortBy === col;
  const handleClick = () => onSort(col, active && sortOrder === 'desc' ? 'asc' : 'desc');
  return (
    <button
      className={`flex items-center gap-1 group hover:text-gray-700 text-xs font-semibold text-gray-500 uppercase tracking-wider ${align === 'right' ? 'ml-auto' : ''}`}
      onClick={handleClick}
    >
      {label}
      {active
        ? sortOrder === 'asc'
          ? <ChevronUp size={11} />
          : <ChevronDown size={11} />
        : <ChevronsUpDown size={11} className="opacity-30 group-hover:opacity-70" />
      }
    </button>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  holdings: Holding[];
  loading: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (col: string, order: 'asc' | 'desc') => void;
  onRefreshOne: (code: string) => Promise<void>;
  onDrillDown: (securityCode: string) => void;
  onSetTicker: (securityCode: string, tickerCode: string) => Promise<void>;
  showAccountColumn?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HoldingsTable({
  holdings,
  loading,
  sortBy,
  sortOrder,
  onSortChange,
  onRefreshOne,
  onDrillDown,
  onSetTicker,
  showAccountColumn,
}: Props) {
  const accountColumn: ColumnDef<Holding> = {
    id: 'account_name',
    accessorKey: 'account_name',
    size: 100,
    header: () => (
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">계좌</span>
    ),
    cell: ({ getValue }) => (
      <span className="text-xs text-gray-600 truncate max-w-[90px] block" title={String(getValue() ?? '')}>
        {String(getValue() ?? '-')}
      </span>
    ),
  };

  const columns: ColumnDef<Holding>[] = [
    ...(showAccountColumn ? [accountColumn] : []),
    {
      id: 'security',
      accessorKey: 'security_name',
      size: 160,
      header: () => (
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">종목</span>
      ),
      cell: ({ row }) => {
        const h = row.original;
        return (
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-gray-900 truncate max-w-[130px]" title={h.security_name}>{h.security_name}</p>
              {h.currency === 'USD' && (
                <span className="flex-shrink-0 text-[10px] font-semibold bg-blue-100 text-blue-600 px-1 py-0.5 rounded">USD</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <TickerCell holding={h} onSetTicker={onSetTicker} />
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-400">{h.market || '-'}</span>
            </div>
          </div>
        );
      },
    },
    {
      id: 'quantity',
      accessorKey: 'quantity',
      size: 70,
      header: () => (
        <div className="text-right">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">수량</span>
        </div>
      ),
      meta: { align: 'right' },
      cell: ({ getValue }) => (
        <span className="tabular-nums text-sm text-gray-700">
          {(getValue() as number).toLocaleString('ko-KR')}
        </span>
      ),
    },
    {
      id: 'avg_buy_price',
      accessorKey: 'avg_buy_price',
      size: 110,
      header: () => (
        <SortHeader label="평균단가" col="avg_buy_price" sortBy={sortBy} sortOrder={sortOrder} onSort={onSortChange} />
      ),
      meta: { align: 'right' },
      cell: ({ row }) => {
        const h = row.original;
        const isUsd = h.currency === 'USD';
        return (
          <div className="text-right">
            {isUsd && h.avg_buy_price_usd > 0 ? (
              <>
                <span className="tabular-nums text-sm text-gray-700">
                  ${h.avg_buy_price_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {h.avg_buy_price > 0 && (
                  <div className="text-xs text-gray-400 tabular-nums">{fmtKRW(h.avg_buy_price)}</div>
                )}
              </>
            ) : (
              <span className="tabular-nums text-sm text-gray-700">
                {fmtKRW(h.avg_buy_price)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'current_price',
      accessorKey: 'current_price',
      size: 110,
      header: () => (
        <SortHeader label="현재가" col="current_price" sortBy={sortBy} sortOrder={sortOrder} onSort={onSortChange} />
      ),
      meta: { align: 'right' },
      cell: ({ row }) => {
        const h = row.original;
        const c = h.change_amount;
        return (
          <div className="text-right">
            <p className={`tabular-nums text-sm font-medium ${pnlColor(c)}`}>
              {fmtKRW(h.current_price)}
            </p>
            {h.current_price > 0 && (
              <p className={`text-xs tabular-nums ${pnlColor(c)}`}>
                {pnlSign(c)}{fmtKRW(c)} ({fmtRate(h.change_rate)})
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: 'eval_amount',
      accessorKey: 'eval_amount',
      size: 110,
      header: () => (
        <SortHeader label="평가금액" col="eval_amount" sortBy={sortBy} sortOrder={sortOrder} onSort={onSortChange} />
      ),
      meta: { align: 'right' },
      cell: ({ getValue }) => (
        <span className="tabular-nums text-sm text-gray-700">
          {fmtKRW(getValue() as number)}
        </span>
      ),
    },
    {
      id: 'unrealized_pnl',
      accessorKey: 'unrealized_pnl',
      size: 120,
      header: () => (
        <SortHeader label="평가손익" col="unrealized_pnl" sortBy={sortBy} sortOrder={sortOrder} onSort={onSortChange} />
      ),
      meta: { align: 'right' },
      cell: ({ row }) => {
        const h = row.original;
        const pnl = h.unrealized_pnl;
        return (
          <div className={`text-right ${pnlColor(pnl)}`}>
            <p className="tabular-nums text-sm font-medium">
              {pnlSign(pnl)}{fmtKRW(pnl)}
            </p>
            <p className="text-xs tabular-nums">{fmtRate(h.unrealized_pnl_rate)}</p>
          </div>
        );
      },
    },
    {
      id: 'realized_pnl',
      accessorKey: 'realized_pnl',
      size: 100,
      header: () => (
        <SortHeader label="실현손익" col="realized_pnl" sortBy={sortBy} sortOrder={sortOrder} onSort={onSortChange} />
      ),
      meta: { align: 'right' },
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return (
          <span className={`tabular-nums text-sm ${pnlColor(v)}`}>
            {pnlSign(v)}{fmtKRW(v)}
          </span>
        );
      },
    },
    {
      id: 'price_time',
      size: 60,
      header: () => (
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">시세시각</span>
      ),
      meta: { align: 'right' },
      cell: ({ row }) => (
        <span className="text-xs text-gray-400 tabular-nums">
          {fmtTime(row.original.price_fetched_at)}
        </span>
      ),
    },
    {
      id: 'actions',
      size: 72,
      header: () => null,
      cell: ({ row }) => {
        const h = row.original;
        return (
          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={() => void onRefreshOne(h.ticker_code?.trim() || h.security_code)}
              title="시세 갱신"
              className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
            >
              <RefreshCw size={13} />
            </button>
            <button
              onClick={() => onDrillDown(h.security_code)}
              title="거래내역 보기"
              className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
            >
              <ArrowRight size={13} />
            </button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable<Holding>({
    data: holdings,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    getRowId: (row) => `${row.account_id}-${row.security_code}`,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
        로딩 중...
      </div>
    );
  }

  if (holdings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <TrendingUp size={40} className="mb-3 opacity-30" strokeWidth={1.5} />
        <p className="text-sm">보유 종목이 없습니다.</p>
        <p className="text-xs mt-1">매수 거래를 입력하면 자동으로 집계됩니다.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-gray-200">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className={`px-4 py-3 ${
                    (header.column.columnDef.meta as { align?: string } | undefined)?.align === 'right'
                      ? 'text-right'
                      : 'text-left'
                  }`}
                  style={{ width: header.column.getSize() || undefined }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-gray-100">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50 transition-colors">
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={`px-4 py-3 ${
                    (cell.column.columnDef.meta as { align?: string } | undefined)?.align === 'right'
                      ? 'text-right'
                      : ''
                  }`}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary totals row */}
    </div>
  );
}
