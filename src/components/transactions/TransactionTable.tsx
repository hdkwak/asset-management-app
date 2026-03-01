import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { Pencil, FileText, ChevronUp, ChevronDown, ChevronsUpDown,
         ChevronLeft, ChevronRight, Trash2, Tag } from 'lucide-react';
import type { AnyTransaction, BankTransaction, SecuritiesTransaction, AccountType, Category } from '../../types';

function fmt(n: number) {
  return `₩${Math.abs(n).toLocaleString('ko-KR')}`;
}

// ── SortHeader ───────────────────────────────────────────────────────────────

interface SortHeaderProps {
  label: string;
  col: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (col: string, order: 'asc' | 'desc') => void;
}

function SortHeader({ label, col, sortBy, sortOrder, onSort }: SortHeaderProps) {
  const active = sortBy === col;
  const handleClick = () => onSort(col, active && sortOrder === 'desc' ? 'asc' : 'desc');
  return (
    <button
      className="flex items-center gap-1 group hover:text-gray-700 text-xs font-semibold text-gray-500 uppercase tracking-wider"
      onClick={handleClick}
    >
      {label}
      {active
        ? sortOrder === 'asc'
          ? <ChevronUp size={12} />
          : <ChevronDown size={12} />
        : <ChevronsUpDown size={12} className="opacity-30 group-hover:opacity-70" />
      }
    </button>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  transactions: AnyTransaction[];
  accountType: AccountType;
  categories: Category[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (col: string, order: 'asc' | 'desc') => void;
  onPageChange: (page: number) => void;
  onEdit: (tx: AnyTransaction) => void;
  onBulkDelete: (ids: number[]) => void;
  onBulkCategory?: (ids: number[], categoryId: number | null) => void;
  isGroupView?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export function TransactionTable({
  transactions,
  accountType,
  categories,
  loading,
  total,
  page,
  totalPages,
  sortBy,
  sortOrder,
  onSortChange,
  onPageChange,
  onEdit,
  onBulkDelete,
  onBulkCategory,
  isGroupView = false,
}: Props) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const isBank = accountType === 'bank';

  const getCategoryName = (id: number | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? '-') : '-';

  // ── Column definitions ──────────────────────────────────────────────────

  const baseColumns: ColumnDef<AnyTransaction>[] = [
    {
      id: 'select',
      size: 36,
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          className="rounded border-gray-300"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="rounded border-gray-300"
        />
      ),
    },
    {
      id: 'date',
      accessorKey: 'date',
      size: 100,
      header: () => (
        <SortHeader label="날짜" col="date" sortBy={sortBy} sortOrder={sortOrder} onSort={onSortChange} />
      ),
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-gray-600 whitespace-nowrap">{getValue() as string}</span>
      ),
    },
  ];

  const bankColumns: ColumnDef<AnyTransaction>[] = [
    {
      id: 'payee',
      accessorKey: 'payee',
      header: () => (
        <SortHeader label="거래처" col="payee" sortBy={sortBy} sortOrder={sortOrder} onSort={onSortChange} />
      ),
      cell: ({ getValue }) => (
        <span className="text-gray-800 max-w-[160px] truncate block">
          {(getValue() as string) || <span className="text-gray-300">-</span>}
        </span>
      ),
    },
    {
      id: 'category_id',
      accessorKey: 'category_id',
      header: () => <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">카테고리</span>,
      cell: ({ getValue }) => (
        <span className="text-xs text-gray-500">{getCategoryName(getValue() as number | null)}</span>
      ),
    },
    {
      id: 'amount',
      accessorKey: 'amount',
      header: () => (
        <SortHeader label="금액" col="amount" sortBy={sortBy} sortOrder={sortOrder} onSort={onSortChange} />
      ),
      meta: { align: 'right' },
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return (
          <span className={`font-medium tabular-nums ${v >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {v >= 0 ? '+' : '-'}{fmt(v)}
          </span>
        );
      },
    },
    {
      id: 'balance',
      accessorKey: 'balance',
      size: 120,
      header: () => (
        <SortHeader label="잔고" col="balance" sortBy={sortBy} sortOrder={sortOrder} onSort={onSortChange} />
      ),
      meta: { align: 'right' },
      cell: ({ getValue }) => {
        const v = getValue() as number;
        if (!v || v === 0) return <span className="text-gray-300">-</span>;
        return (
          <span className="font-mono tabular-nums text-gray-600">
            ₩{v.toLocaleString('ko-KR')}
          </span>
        );
      },
    },
    {
      id: 'note',
      accessorKey: 'note',
      header: () => <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">메모</span>,
      cell: ({ getValue }) => (
        <span className="text-gray-500 text-xs max-w-[180px] truncate block">{(getValue() as string) || ''}</span>
      ),
    },
  ];

  const secColumns: ColumnDef<AnyTransaction>[] = [
    {
      id: 'type',
      accessorKey: 'type',
      header: () => (
        <SortHeader label="유형" col="type" sortBy={sortBy} sortOrder={sortOrder} onSort={onSortChange} />
      ),
      cell: ({ getValue }) => (
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          {getValue() as string}
        </span>
      ),
    },
    {
      id: 'security',
      accessorKey: 'security',
      header: () => (
        <SortHeader label="종목" col="security" sortBy={sortBy} sortOrder={sortOrder} onSort={onSortChange} />
      ),
      cell: ({ row }) => {
        const tx = row.original as SecuritiesTransaction;
        return (
          <div className="max-w-[140px]">
            <p className="text-gray-800 truncate">{tx.security}</p>
            <p className="text-gray-400 text-xs">{tx.security_code}</p>
          </div>
        );
      },
    },
    {
      id: 'description',
      accessorKey: 'description',
      header: () => <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">내용</span>,
      cell: ({ getValue }) => (
        <span className="text-gray-500 text-xs max-w-[180px] truncate block">{getValue() as string}</span>
      ),
    },
    {
      id: 'amount',
      accessorKey: 'amount',
      header: () => (
        <SortHeader label="금액" col="amount" sortBy={sortBy} sortOrder={sortOrder} onSort={onSortChange} />
      ),
      meta: { align: 'right' },
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return (
          <span className="font-medium tabular-nums text-gray-800">
            {v >= 0 ? '+' : ''}{v.toLocaleString('ko-KR')}
          </span>
        );
      },
    },
    {
      id: 'balance',
      accessorKey: 'balance',
      header: () => <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">잔고</span>,
      meta: { align: 'right' },
      cell: ({ getValue }) => (
        <span className="text-gray-500 tabular-nums text-xs">
          {(getValue() as number).toLocaleString('ko-KR')}
        </span>
      ),
    },
  ];

  const groupCol: ColumnDef<AnyTransaction> = {
    id: 'account_name',
    accessorKey: 'account_name',
    header: () => <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">계좌</span>,
    cell: ({ row }) => {
      const tx = row.original;
      return (
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: tx.account_color ?? '#999' }}
          />
          <span className="text-xs text-gray-700 truncate max-w-[120px]">{tx.account_name ?? '-'}</span>
        </div>
      );
    },
  };

  const actionCol: ColumnDef<AnyTransaction> = {
    id: 'actions',
    size: 40,
    header: () => null,
    cell: ({ row }) => (
      <button
        onClick={() => onEdit(row.original)}
        className="text-gray-400 hover:text-gray-700 p-1 rounded transition-colors"
        title="편집"
      >
        <Pencil size={14} />
      </button>
    ),
  };

  const midCols = isBank ? bankColumns : secColumns;
  const columns: ColumnDef<AnyTransaction>[] = isGroupView
    ? [...baseColumns, groupCol, ...midCols, actionCol]
    : [...baseColumns, ...midCols, actionCol];

  // ── Table instance ──────────────────────────────────────────────────────

  const table = useReactTable<AnyTransaction>({
    data: transactions,
    columns,
    state: { rowSelection },
    getRowId: (row) => String(row.id),
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    pageCount: totalPages,
  });

  const selectedIds = Object.keys(rowSelection)
    .filter((k) => rowSelection[k])
    .map(Number);

  const handleBulkDelete = () => {
    if (!selectedIds.length) return;
    if (window.confirm(`선택한 ${selectedIds.length}건의 거래 내역을 삭제합니다. 계속하시겠습니까?`)) {
      onBulkDelete(selectedIds);
      setRowSelection({});
    }
  };

  const handleBulkCategory = (categoryId: number | null) => {
    if (!onBulkCategory || !selectedIds.length) return;
    onBulkCategory(selectedIds, categoryId);
    setRowSelection({});
    setCategoryPickerOpen(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
        로딩 중...
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <FileText size={40} className="mb-3 opacity-30" strokeWidth={1.5} />
        <p className="text-sm">거래 내역이 없습니다.</p>
        <p className="text-xs mt-1">Import 버튼으로 파일을 가져오거나 직접 추가하세요.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border-b border-blue-100 relative">
          <span className="text-sm text-blue-700 font-medium">{selectedIds.length}건 선택됨</span>
          {isBank && onBulkCategory && (
            <div className="relative">
              <button
                onClick={() => setCategoryPickerOpen((v) => !v)}
                className="flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 font-medium"
              >
                <Tag size={14} /> 카테고리 지정
              </button>
              {categoryPickerOpen && (
                <div className="absolute top-7 left-0 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                  <button
                    onClick={() => handleBulkCategory(null)}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                  >
                    미분류
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleBulkCategory(cat.id)}
                      className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium"
          >
            <Trash2 size={14} /> 삭제
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-gray-200">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-4 py-3 text-left ${
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
              <tr
                key={row.id}
                className={`hover:bg-slate-50 transition-colors ${row.getIsSelected() ? 'bg-blue-50' : ''}`}
              >
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
      </div>

      {/* Footer: count + pagination */}
      <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">총 {total.toLocaleString()}건</span>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 text-gray-600"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-gray-600 px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 text-gray-600"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
