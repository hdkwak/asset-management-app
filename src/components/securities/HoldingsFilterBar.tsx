import React from 'react';
import { Search, X } from 'lucide-react';

interface Props {
  includeZero: boolean;
  search: string;
  onIncludeZeroChange: (v: boolean) => void;
  onSearchChange: (v: string) => void;
}

export function HoldingsFilterBar({
  includeZero,
  search,
  onIncludeZeroChange,
  onSearchChange,
}: Props) {
  return (
    <div className="px-4 py-2 flex items-center gap-3 flex-shrink-0 flex-1">
      {/* 보유중 / 전체 toggle */}
      <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
        <button
          className={`px-3 py-1.5 font-medium transition-colors ${
            !includeZero ? 'bg-blue-800 text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
          onClick={() => onIncludeZeroChange(false)}
        >
          보유중
        </button>
        <button
          className={`px-3 py-1.5 font-medium transition-colors ${
            includeZero ? 'bg-blue-800 text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
          onClick={() => onIncludeZeroChange(true)}
        >
          전체
        </button>
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="종목명·코드 검색"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
