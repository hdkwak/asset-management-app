import React from 'react';
import { Pencil } from 'lucide-react';
import type { Account } from '../../types';

function formatBalance(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`;
}

interface Props {
  account: Account;
  isSelected: boolean;
  onClick: () => void;
  onEdit: () => void;
}

export function AccountCard({ account, isSelected, onClick, onEdit }: Props) {
  return (
    <div
      className={`flex items-center px-3 py-2 rounded-lg cursor-pointer group transition-colors ${
        isSelected ? 'bg-slate-700' : 'hover:bg-slate-700/60'
      }`}
      onClick={onClick}
    >
      {/* Color dot */}
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: account.color }}
      />

      {/* Name + Balance */}
      <div className="flex-1 ml-2.5 min-w-0">
        <p className="text-sm text-white truncate font-medium">{account.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {formatBalance(account.balance)}
        </p>
      </div>

      {/* Edit button (visible on hover) */}
      <button
        className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-white transition-all flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        title="계좌 편집"
      >
        <Pencil size={12} />
      </button>
    </div>
  );
}
