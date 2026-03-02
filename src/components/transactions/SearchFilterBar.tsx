import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import type { Category, FilterState, AccountType } from '../../types';

function quickDate(type: 'this-month' | 'last-month' | '3months' | 'this-year') {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = now.getMonth(); // 0-indexed

  if (type === 'this-month') {
    const from = `${yyyy}-${String(mm + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(yyyy, mm + 1, 0).getDate();
    const to = `${yyyy}-${String(mm + 1).padStart(2, '0')}-${lastDay}`;
    return { from, to };
  }
  if (type === 'last-month') {
    const lm = mm === 0 ? 12 : mm;
    const ly = mm === 0 ? yyyy - 1 : yyyy;
    const lastDay = new Date(ly, lm, 0).getDate();
    const from = `${ly}-${String(lm).padStart(2, '0')}-01`;
    const to = `${ly}-${String(lm).padStart(2, '0')}-${lastDay}`;
    return { from, to };
  }
  if (type === '3months') {
    const d = new Date(yyyy, mm - 2, 1);
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(yyyy, mm + 1, 0).getDate();
    const to = `${yyyy}-${String(mm + 1).padStart(2, '0')}-${lastDay}`;
    return { from, to };
  }
  // this-year
  return { from: `${yyyy}-01-01`, to: `${yyyy}-12-31` };
}

interface Props {
  accountType: AccountType;
  categories: Category[];
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onReset: () => void;
}

export function SearchFilterBar({ accountType, categories, filters, onChange, onReset }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  const applyQuick = (type: Parameters<typeof quickDate>[0]) => {
    const { from, to } = quickDate(type);
    set({ dateFrom: from, dateTo: to });
  };

  const hasActiveFilters =
    filters.search || filters.dateFrom || filters.dateTo ||
    filters.amountMin || filters.amountMax ||
    filters.categoryId || filters.incomeType || filters.secType ||
    filters.securityCode;

  const quickBtns: { label: string; type: Parameters<typeof quickDate>[0] }[] = [
    { label: '이번 달', type: 'this-month' },
    { label: '지난 달', type: 'last-month' },
    { label: '최근 3개월', type: '3months' },
    { label: '올해', type: 'this-year' },
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 space-y-2">
      {/* Row 1: search + quick date buttons + reset */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={accountType === 'bank' ? '거래처·메모 검색' : '종목·내용 검색'}
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          {filters.search && (
            <button
              onClick={() => set({ search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Quick date buttons */}
        <div className="flex gap-1">
          {quickBtns.map(({ label, type }) => (
            <button
              key={type}
              onClick={() => applyQuick(type)}
              className="px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        {/* Security code drill-down chip */}
        {filters.securityCode && (
          <span className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
            종목: {filters.securityCode}
            <button
              onClick={() => set({ securityCode: '' })}
              className="text-blue-400 hover:text-blue-700"
            >
              <X size={11} />
            </button>
          </span>
        )}

        {/* Reset */}
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg transition-colors"
          >
            <RotateCcw size={12} /> 초기화
          </button>
        )}
      </div>

      {/* Row 2: date range + amount + type-specific filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set({ dateFrom: e.target.value })}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-700"
          />
          <span className="text-gray-400 text-xs">~</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => set({ dateTo: e.target.value })}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-700"
          />
        </div>

        {/* Amount range */}
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            placeholder="최소 금액"
            value={filters.amountMin}
            onChange={(e) => set({ amountMin: e.target.value })}
            className="w-28 text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-700"
          />
          <span className="text-gray-400 text-xs">~</span>
          <input
            type="number"
            placeholder="최대 금액"
            value={filters.amountMax}
            onChange={(e) => set({ amountMax: e.target.value })}
            className="w-28 text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-700"
          />
        </div>

        {/* Bank-specific: income type + category */}
        {accountType === 'bank' && (
          <>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
              {(['', 'income', 'expense'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => set({ incomeType: v })}
                  className={`px-2.5 py-1.5 font-medium transition-colors ${
                    filters.incomeType === v
                      ? 'bg-blue-800 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {v === '' ? '전체' : v === 'income' ? '입금' : '출금'}
                </button>
              ))}
            </div>

            {categories.length > 0 && (
              <select
                value={filters.categoryId ?? ''}
                onChange={(e) => set({ categoryId: e.target.value ? Number(e.target.value) : null })}
                className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">전체 카테고리</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </>
        )}

        {/* Securities-specific: transaction type */}
        {accountType === 'securities' && (
          <select
            value={filters.secType}
            onChange={(e) => set({ secType: e.target.value })}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">전체 유형</option>
            {['매수', '매도', '배당', '이자', '입금', '출금', '기타'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
