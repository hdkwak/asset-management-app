import React, { useState, useEffect } from 'react';
import { PlusCircle, Upload } from 'lucide-react';
import { useTransactions } from '../../hooks/useTransactions';
import { useHoldings } from '../../hooks/useHoldings';
import { TransactionTable } from '../transactions/TransactionTable';
import { TransactionForm } from '../transactions/TransactionForm';
import { SearchFilterBar } from '../transactions/SearchFilterBar';
import { ImportModal } from '../import/ImportModal';
import { ImportHistoryPanel } from '../import/ImportHistory';
import { SecuritiesAccountHeader } from './SecuritiesAccountHeader';
import { HoldingsFilterBar } from './HoldingsFilterBar';
import { HoldingsTable } from './HoldingsTable';
import type {
  Account,
  AnyTransaction,
  Category,
  CreateTransactionPayload,
  FilterState,
} from '../../types';
import { defaultFilters } from '../../types';
import { bulkUpdateCategory } from '../../api/client';

const PAGE_SIZE = 50;

type TabKey = 'transactions' | 'holdings' | 'history';

interface Props {
  account: Account;
  categories: Category[];
  onSyncBalance: () => void;
}

export function SecuritiesAccountPage({ account, categories, onSyncBalance }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('transactions');

  // ── Transactions tab state ──────────────────────────────────────────────────
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingTx, setEditingTx] = useState<AnyTransaction | null>(null);
  const [addingTx, setAddingTx] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => { setPage(1); }, [filters]);

  const {
    transactions,
    total,
    totalPages,
    currentPage,
    loading: txLoading,
    fetchTransactions,
    addTransaction,
    editTransaction,
    bulkRemove,
  } = useTransactions({
    accountId: account.id,
    accountType: account.type,
    filters,
    page,
    limit: PAGE_SIZE,
    sortBy,
    sortOrder,
  });

  const handleSortChange = (col: string, order: 'asc' | 'desc') => {
    setSortBy(col);
    setSortOrder(order);
    setPage(1);
  };

  const handleSaveTx = async (data: CreateTransactionPayload) => {
    if (editingTx) {
      await editTransaction(editingTx.id, data);
    } else {
      await addTransaction(data);
    }
    setEditingTx(null);
    setAddingTx(false);
    await onSyncBalance();
    await holdingsRefetch();
  };

  const handleBulkDelete = async (ids: number[]) => {
    await bulkRemove(ids);
    await onSyncBalance();
    await holdingsRefetch();
  };

  const handleBulkCategory = async (ids: number[], categoryId: number | null) => {
    await bulkUpdateCategory(ids, categoryId);
    await fetchTransactions();
  };

  const handleImported = async () => {
    await fetchTransactions();
    await onSyncBalance();
    await holdingsRefetch();
  };

  // ── Holdings tab state ──────────────────────────────────────────────────────
  const [includeZero, setIncludeZero] = useState(false);
  const [holdingsSearch, setHoldingsSearch] = useState('');
  const [holdingsSortBy, setHoldingsSortBy] = useState('');
  const [holdingsSortOrder, setHoldingsSortOrder] = useState<'asc' | 'desc'>('desc');

  const {
    data: holdingsData,
    loading: holdingsLoading,
    refreshing,
    refetch: holdingsRefetch,
    refreshAll,
    refreshOne,
  } = useHoldings({
    accountId: account.id,
    includeZero,
    search: holdingsSearch,
    sortBy: holdingsSortBy,
    sortOrder: holdingsSortOrder,
  });

  const handleHoldingsSortChange = (col: string, order: 'asc' | 'desc') => {
    setHoldingsSortBy(col);
    setHoldingsSortOrder(order);
  };

  // Drill-down: click a holding → switch to transactions tab filtered by that security
  const handleDrillDown = (securityCode: string) => {
    setFilters({ ...defaultFilters, securityCode });
    setPage(1);
    setActiveTab('transactions');
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'transactions', label: '거래 내역' },
    { key: 'holdings',     label: '보유 종목' },
    { key: 'history',      label: 'Import 기록' },
  ];

  return (
    <>
      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 flex-shrink-0 flex items-center justify-between">
        <div className="flex gap-0">
          {tabs.map((t) => (
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
        {/* Action buttons — only shown in transactions tab */}
        {activeTab === 'transactions' && (
          <div className="flex gap-2 pb-1">
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Upload size={13} /> Import
            </button>
            <button
              onClick={() => { setEditingTx(null); setAddingTx(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-800 rounded-lg hover:bg-blue-900 transition-colors"
            >
              <PlusCircle size={13} /> 거래 추가
            </button>
          </div>
        )}
      </div>

      {/* ── Holdings tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'holdings' && (
        <>
          <SecuritiesAccountHeader
            summary={holdingsData?.summary ?? null}
            loading={holdingsLoading}
            refreshing={refreshing}
            onRefresh={refreshAll}
          />
          <HoldingsFilterBar
            includeZero={includeZero}
            search={holdingsSearch}
            onIncludeZeroChange={setIncludeZero}
            onSearchChange={setHoldingsSearch}
          />
          <div className="flex-1 bg-white mt-4 mx-4 mb-4 rounded-xl border border-gray-200 overflow-hidden">
            <HoldingsTable
              holdings={holdingsData?.holdings ?? []}
              loading={holdingsLoading}
              sortBy={holdingsSortBy}
              sortOrder={holdingsSortOrder}
              onSortChange={handleHoldingsSortChange}
              onRefreshOne={refreshOne}
              onDrillDown={handleDrillDown}
            />
          </div>
        </>
      )}

      {/* ── Transactions tab ─────────────────────────────────────────────────── */}
      {activeTab === 'transactions' && (
        <>
          <SearchFilterBar
            accountType="securities"
            categories={categories}
            filters={filters}
            onChange={(f) => setFilters(f)}
            onReset={() => setFilters(defaultFilters)}
          />
          <div className="flex-1 bg-white mt-4 mx-4 mb-4 rounded-xl border border-gray-200 overflow-hidden">
            <TransactionTable
              transactions={transactions}
              accountType="securities"
              categories={categories}
              loading={txLoading}
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
            />
          </div>
        </>
      )}

      {/* ── Import history tab ───────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="flex-1 bg-white mt-4 mx-4 mb-4 rounded-xl border border-gray-200 overflow-hidden">
          <ImportHistoryPanel accountId={account.id} />
        </div>
      )}

      {/* Transaction form modal */}
      {addingTx && (
        <TransactionForm
          accountId={account.id}
          accountType="securities"
          categories={categories}
          transaction={editingTx ?? undefined}
          onSave={handleSaveTx}
          onClose={() => { setAddingTx(false); setEditingTx(null); }}
        />
      )}

      {/* Import modal */}
      {importOpen && (
        <ImportModal
          accountId={account.id}
          accountType="securities"
          institution={account.institution}
          onClose={() => setImportOpen(false)}
          onImported={handleImported}
        />
      )}
    </>
  );
}
