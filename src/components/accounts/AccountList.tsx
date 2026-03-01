import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Landmark, TrendingUp } from 'lucide-react';
import type { Account, AccountType } from '../../types';
import { AccountCard } from './AccountCard';

interface Props {
  title: string;
  type: AccountType;
  accounts: Account[];
  selectedAccountId: number | null;
  isGroupSelected: boolean;
  onSelectGroup: () => void;
  onSelectAccount: (id: number) => void;
  onAddAccount: () => void;
  onEditAccount: (account: Account) => void;
}

export function AccountList({
  title,
  type,
  accounts,
  selectedAccountId,
  isGroupSelected,
  onSelectGroup,
  onSelectAccount,
  onAddAccount,
  onEditAccount,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const Icon = type === 'bank' ? Landmark : TrendingUp;

  return (
    <div className="mb-2">
      {/* Group header */}
      <div className="flex items-center">
        <button
          className={`flex-1 flex items-center gap-2 px-3 py-2 transition-colors rounded-lg ${
            isGroupSelected
              ? 'bg-slate-600 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
          }`}
          onClick={onSelectGroup}
        >
          <Icon size={14} className="flex-shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider flex-1 text-left">
            {title}
          </span>
          <span className={`text-xs ${isGroupSelected ? 'text-slate-300' : 'text-slate-500'}`}>
            {accounts.length}
          </span>
        </button>
        <button
          className="p-2 text-slate-500 hover:text-slate-300 transition-colors"
          onClick={(e) => { e.stopPropagation(); setCollapsed((c) => !c); }}
          title={collapsed ? '펼치기' : '접기'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-1 space-y-0.5 pl-1">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              isSelected={selectedAccountId === account.id}
              onClick={() => onSelectAccount(account.id)}
              onEdit={() => onEditAccount(account)}
            />
          ))}

          {/* Add account button */}
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700/40 rounded-lg transition-colors text-xs"
            onClick={onAddAccount}
          >
            <Plus size={13} />
            <span>계좌 추가</span>
          </button>
        </div>
      )}
    </div>
  );
}
