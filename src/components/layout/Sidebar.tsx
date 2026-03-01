import React, { useState } from 'react';
import { BarChart2, Settings } from 'lucide-react';
import type { Account, AccountType } from '../../types';
import { useAccounts } from '../../hooks/useAccounts';
import { AccountList } from '../accounts/AccountList';
import { AccountForm } from '../accounts/AccountForm';

interface FormState {
  open: boolean;
  type: AccountType;
  account?: Account;
}

export function Sidebar() {
  const {
    accounts,
    selectedAccount,
    groupAccountType,
    activePage,
    selectAccount,
    selectGroup,
    goHome,
    goAnalytics,
    goSettings,
    loading,
  } = useAccounts();

  const [form, setForm] = useState<FormState>({ open: false, type: 'bank' });

  const bankAccounts = accounts.filter((a) => a.type === 'bank');
  const securitiesAccounts = accounts.filter((a) => a.type === 'securities');

  const openAdd = (type: AccountType) =>
    setForm({ open: true, type, account: undefined });

  const openEdit = (account: Account) =>
    setForm({ open: true, type: account.type, account });

  const closeForm = () => setForm((f) => ({ ...f, open: false }));

  return (
    <>
      <aside
        className="flex flex-col h-screen flex-shrink-0 overflow-y-auto"
        style={{ width: 260, backgroundColor: '#1E293B' }}
      >
        {/* Logo */}
        <button
          className="px-5 py-5 border-b border-slate-700 text-left hover:bg-slate-700/30 transition-colors"
          onClick={goHome}
        >
          <span className="text-white font-bold text-lg">💰 자산관리</span>
        </button>

        {/* Account lists */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {loading ? (
            <p className="text-slate-500 text-xs px-3 py-2">불러오는 중...</p>
          ) : (
            <>
              <AccountList
                title="은행 계좌"
                type="bank"
                accounts={bankAccounts}
                selectedAccountId={selectedAccount?.id ?? null}
                isGroupSelected={groupAccountType === 'bank'}
                onSelectGroup={() => selectGroup('bank')}
                onSelectAccount={selectAccount}
                onAddAccount={() => openAdd('bank')}
                onEditAccount={openEdit}
              />

              {/* Analytics link (below bank section) */}
              <button
                onClick={goAnalytics}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors mt-1 ${
                  activePage === 'analytics'
                    ? 'bg-slate-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }`}
              >
                <BarChart2 size={15} />
                수입·지출 분석
              </button>

              <div className="border-t border-slate-700 my-3" />
              <AccountList
                title="증권 계좌"
                type="securities"
                accounts={securitiesAccounts}
                selectedAccountId={selectedAccount?.id ?? null}
                isGroupSelected={groupAccountType === 'securities'}
                onSelectGroup={() => selectGroup('securities')}
                onSelectAccount={selectAccount}
                onAddAccount={() => openAdd('securities')}
                onEditAccount={openEdit}
              />
            </>
          )}
        </nav>

        {/* Settings link at bottom */}
        <div className="px-3 py-3 border-t border-slate-700">
          <button
            onClick={goSettings}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activePage === 'settings'
                ? 'bg-slate-600 text-white'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}
          >
            <Settings size={15} />
            설정
          </button>
        </div>
      </aside>

      {form.open && (
        <AccountForm
          type={form.type}
          account={form.account}
          onClose={closeForm}
        />
      )}
    </>
  );
}
