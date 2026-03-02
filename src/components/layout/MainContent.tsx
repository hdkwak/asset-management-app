import React, { useState, useEffect, useRef } from 'react';
import { Landmark, TrendingUp, PlusCircle, Upload, Download } from 'lucide-react';
import { useAccounts } from '../../hooks/useAccounts';
import { useTransactions } from '../../hooks/useTransactions';
import { TransactionTable } from '../transactions/TransactionTable';
import { TransactionForm } from '../transactions/TransactionForm';
import { SearchFilterBar } from '../transactions/SearchFilterBar';
import { ImportModal } from '../import/ImportModal';
import { Dashboard } from '../dashboard/Dashboard';
import { BankAnalytics } from '../analytics/BankAnalytics';
import { SettingsPage } from '../../pages/SettingsPage';
import { ImportHistoryPanel } from '../import/ImportHistory';
import type { AnyTransaction, BankTransaction, SecuritiesTransaction, Category, CreateTransactionPayload, AccountType, FilterState } from '../../types';
import { defaultFilters } from '../../types';
import { getCategories, bulkUpdateCategory, getTransactions } from '../../api/client';
import {
  exportBankTransactionsToCSV,
  exportBankTransactionsToExcel,
  exportSecuritiesTransactionsToCSV,
  exportSecuritiesTransactionsToExcel,
} from '../../utils/export';
import { useToast } from '../common/Toast';

const PAGE_SIZE = 50;

function formatBalance(n: number) {
  return `₩${n.toLocaleString('ko-KR')}`;
}

export function MainContent() {
  const { accounts, selectedAccount, groupAccountType, activePage, refreshAccounts } = useAccounts();

  // Filter / pagination / sort state
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [filters]);

  // Determine view mode
  const isHome = !selectedAccount && !groupAccountType;
  const isGroupView = !selectedAccount && !!groupAccountType;
  const currentAccountType: AccountType | null =
    selectedAccount?.type ?? groupAccountType ?? null;

  const {
    transactions,
    total,
    totalPages,
    currentPage,
    loading,
    fetchTransactions,
    addTransaction,
    editTransaction,
    bulkRemove,
  } = useTransactions({
    accountId: selectedAccount?.id ?? null,
    groupType: groupAccountType,
    accountType: currentAccountType,
    filters,
    page,
    limit: PAGE_SIZE,
    sortBy,
    sortOrder,
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [editingTx, setEditingTx] = useState<AnyTransaction | null>(null);
  const [addingTx, setAddingTx] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'transactions' | 'history'>('transactions');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  const handleBulkCategory = async (ids: number[], categoryId: number | null) => {
    await bulkUpdateCategory(ids, categoryId);
    await fetchTransactions();
  };

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
  }, [activePage]);

  const syncBalance = () => refreshAccounts();

  const handleSaveTx = async (data: CreateTransactionPayload) => {
    if (editingTx) {
      await editTransaction(editingTx.id, data);
    } else {
      await addTransaction(data);
    }
    setEditingTx(null);
    setAddingTx(false);
    await syncBalance();
  };

  const handleBulkDelete = async (ids: number[]) => {
    await bulkRemove(ids);
    await syncBalance();
  };

  const handleImported = async () => {
    await fetchTransactions();
    await syncBalance();
  };

  const handleSortChange = (col: string, order: 'asc' | 'desc') => {
    setSortBy(col);
    setSortOrder(order);
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setPage(1);
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExportMenuOpen(false);
    if (!currentAccountType) return;
    try {
      const result = await getTransactions({
        accountId: selectedAccount?.id ?? null,
        group: isGroupView ? groupAccountType : null,
        filters,
        page: 1,
        limit: 9999,
        sortBy,
        sortOrder,
      });
      const rows = result.data;
      const accountName = selectedAccount?.name ?? (groupAccountType === 'bank' ? '은행전체' : '증권전체');
      const dateStr = new Date().toISOString().slice(0, 10);
      const base = `${accountName}_${dateStr}`;

      if (currentAccountType === 'bank') {
        const bankRows = rows as BankTransaction[];
        if (format === 'csv') exportBankTransactionsToCSV(bankRows, `${base}.csv`);
        else exportBankTransactionsToExcel(bankRows, `${base}.xlsx`);
      } else {
        const secRows = rows as SecuritiesTransaction[];
        if (format === 'csv') exportSecuritiesTransactionsToCSV(secRows, `${base}.csv`);
        else exportSecuritiesTransactionsToExcel(secRows, `${base}.xlsx`);
      }
      addToast(`${rows.length}건 내보내기 완료`, 'success');
    } catch (err) {
      addToast(`내보내기 실패: ${(err as Error).message}`, 'error');
    }
  };

  // ── Analytics / Settings pages ─────────────────────────────────────────────
  if (activePage === 'analytics') {
    return <BankAnalytics accounts={accounts} />;
  }
  if (activePage === 'settings') {
    return <SettingsPage />;
  }

  // ── Home (Dashboard) ───────────────────────────────────────────────────────
  if (isHome) {
    return (
      <main className="flex-1 flex flex-col bg-slate-50 overflow-auto min-w-0">
        <Dashboard />
      </main>
    );
  }

  // ── Shared: header for group or account view ───────────────────────────────
  const groupLabel = groupAccountType === 'bank' ? '은행 계좌 전체' : '증권 계좌 전체';
  const GroupIcon = groupAccountType === 'bank' ? Landmark : TrendingUp;

  return (
    <main className="flex-1 flex flex-col bg-slate-50 overflow-auto min-w-0">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          {isGroupView ? (
            <>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#1E40AF22' }}
              >
                <GroupIcon size={20} style={{ color: '#1E40AF' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-gray-900">{groupLabel}</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {groupAccountType === 'bank' ? '은행' : '증권'} 그룹 전체 거래 내역
                </p>
              </div>
              <div className="text-right flex-shrink-0 mr-4">
                <p className="text-xs text-gray-500 mb-0.5">총 거래 건수</p>
                <p className="text-2xl font-bold text-gray-900">{total.toLocaleString()}건</p>
              </div>
            </>
          ) : selectedAccount ? (
            <>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: selectedAccount.color + '22' }}
              >
                {selectedAccount.type === 'bank'
                  ? <Landmark size={20} style={{ color: selectedAccount.color }} />
                  : <TrendingUp size={20} style={{ color: selectedAccount.color }} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-gray-900 truncate">{selectedAccount.name}</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {selectedAccount.institution}
                  <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {selectedAccount.type === 'bank' ? '은행 계좌' : '증권 계좌'}
                  </span>
                </p>
              </div>
              <div className="text-right flex-shrink-0 mr-4">
                <p className="text-xs text-gray-500 mb-0.5">현재 잔고</p>
                <p className="text-2xl font-bold text-gray-900">{formatBalance(selectedAccount.balance)}</p>
              </div>
            </>
          ) : null}

          {/* Action buttons */}
          <div className="flex gap-2 flex-shrink-0">
            {/* Export dropdown */}
            {currentAccountType && (
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setExportMenuOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download size={15} /> Export
                </button>
                {exportMenuOpen && (
                  <div className="absolute right-0 top-9 z-30 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                    <button
                      onClick={() => handleExport('csv')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      CSV 다운로드
                    </button>
                    <button
                      onClick={() => handleExport('xlsx')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Excel 다운로드
                    </button>
                  </div>
                )}
              </div>
            )}
            {selectedAccount && (
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Upload size={15} /> Import
              </button>
            )}
            {selectedAccount && (
              <button
                onClick={() => { setEditingTx(null); setAddingTx(true); }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-800 rounded-lg hover:bg-blue-900 transition-colors"
              >
                <PlusCircle size={15} /> 거래 추가
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Tabs — only shown for individual account views */}
      {selectedAccount && (
        <div className="bg-white border-b border-gray-200 px-6 flex-shrink-0">
          <div className="flex gap-0">
            {([
              { key: 'transactions', label: '거래 내역' },
              { key: 'history',      label: 'Import 기록' },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === t.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Import History tab */}
      {activeTab === 'history' && selectedAccount && (
        <div className="flex-1 bg-white mt-4 mx-4 mb-4 rounded-xl border border-gray-200 overflow-hidden">
          <ImportHistoryPanel accountId={selectedAccount.id} />
        </div>
      )}

      {/* Transactions tab content */}
      {(activeTab === 'transactions' || !selectedAccount) && (
        <>
          {/* Search / filter bar */}
          {currentAccountType && (
            <SearchFilterBar
              accountType={currentAccountType}
              categories={categories}
              filters={filters}
              onChange={(f) => { setFilters(f); }}
              onReset={handleResetFilters}
            />
          )}

          {/* Transaction table */}
          <div className="flex-1 bg-white mt-4 mx-4 mb-4 rounded-xl border border-gray-200 overflow-hidden">
            {currentAccountType && (
              <TransactionTable
                transactions={transactions}
                accountType={currentAccountType}
                categories={categories}
                loading={loading}
                total={total}
                page={currentPage}
                totalPages={totalPages}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={handleSortChange}
                onPageChange={setPage}
                onEdit={(tx) => { setEditingTx(tx); setAddingTx(true); }}
                onBulkDelete={handleBulkDelete}
                onBulkCategory={handleBulkCategory}
                isGroupView={isGroupView}
              />
            )}
          </div>
        </>
      )}

      {/* Transaction add/edit modal */}
      {addingTx && selectedAccount && (
        <TransactionForm
          accountId={selectedAccount.id}
          accountType={selectedAccount.type}
          categories={categories}
          transaction={editingTx ?? undefined}
          onSave={handleSaveTx}
          onClose={() => { setAddingTx(false); setEditingTx(null); }}
        />
      )}

      {/* Import modal */}
      {importOpen && selectedAccount && (
        <ImportModal
          accountId={selectedAccount.id}
          accountType={selectedAccount.type}
          institution={selectedAccount.institution}
          onClose={() => setImportOpen(false)}
          onImported={handleImported}
        />
      )}
    </main>
  );
}
