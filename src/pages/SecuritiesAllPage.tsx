import React, { useState } from 'react';
import { useSecuritiesAnalytics } from '../hooks/useSecuritiesAnalytics';
import { useHoldings } from '../hooks/useHoldings';
import { SecuritiesDashboardHeader } from '../components/securities/SecuritiesDashboardHeader';
import { AssetAllocationChart } from '../components/securities/AssetAllocationChart';
import { AccountAllocationChart } from '../components/securities/AccountAllocationChart';
import { PortfolioHistoryChart } from '../components/securities/PortfolioHistoryChart';
import { PnlRankingChart } from '../components/securities/PnlRankingChart';
import { DividendChart } from '../components/securities/DividendChart';
import { HoldingsTable } from '../components/securities/HoldingsTable';
import type { Account } from '../types';

interface Props {
  accounts: Account[];
}

export function SecuritiesAllPage({ accounts }: Props) {
  const [selectedAccountId, setSelectedAccountId] = useState<number | 'all'>('all');

  const [holdingsSortBy, setHoldingsSortBy] = useState('eval_amount');
  const [holdingsSortOrder, setHoldingsSortOrder] = useState<'asc' | 'desc'>('desc');

  const {
    data: analyticsData,
    loading: analyticsLoading,
    refetch: analyticsRefetch,
  } = useSecuritiesAnalytics({ accountId: selectedAccountId });

  const {
    data: holdingsData,
    loading: holdingsLoading,
    refreshing,
    refetch: holdingsRefetch,
    refreshAll,
    refreshOne,
    setTicker,
  } = useHoldings({
    accountId: selectedAccountId,
    includeZero: false,
    sortBy: holdingsSortBy,
    sortOrder: holdingsSortOrder,
  });

  const handleRefresh = async () => {
    await refreshAll();
    await analyticsRefetch();
  };

  const handleAccountChange = async (id: number | 'all') => {
    setSelectedAccountId(id);
  };

  const handleHoldingsSortChange = (col: string, order: 'asc' | 'desc') => {
    setHoldingsSortBy(col);
    setHoldingsSortOrder(order);
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4 min-w-0">
      {/* 1. KPI + account selector */}
      <SecuritiesDashboardHeader
        summary={analyticsData?.summary ?? null}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onAccountChange={handleAccountChange}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />

      {/* 2. Asset + Account allocation donut charts */}
      <div className="grid grid-cols-2 gap-4">
        <AssetAllocationChart data={analyticsData?.by_security ?? []} />
        <AccountAllocationChart data={analyticsData?.by_account ?? []} />
      </div>

      {/* 3. Portfolio history chart */}
      <PortfolioHistoryChart data={analyticsData?.portfolio_history ?? []} />

      {/* 4. PnL ranking + Dividend charts */}
      <div className="grid grid-cols-2 gap-4">
        <PnlRankingChart data={analyticsData?.pnl_ranking ?? []} />
        <DividendChart data={analyticsData?.monthly_dividend ?? []} />
      </div>

      {/* 5. Holdings table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">보유 종목 전체</h3>
          <p className="text-xs text-gray-400">
            {holdingsData?.holdings.length ?? 0}종목
          </p>
        </div>
        <HoldingsTable
          holdings={holdingsData?.holdings ?? []}
          loading={holdingsLoading}
          sortBy={holdingsSortBy}
          sortOrder={holdingsSortOrder}
          onSortChange={handleHoldingsSortChange}
          onRefreshOne={refreshOne}
          onDrillDown={() => {}}
          onSetTicker={setTicker}
          showAccountColumn={selectedAccountId === 'all'}
        />
      </div>
    </div>
  );
}
