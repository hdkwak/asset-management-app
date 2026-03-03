import { useState, useEffect, useCallback } from 'react';
import { getHoldings, refreshAllPrices, refreshStockPrice, setHoldingTicker } from '../api/client';
import type { HoldingsResponse } from '../types';

interface UseHoldingsParams {
  accountId: number | 'all' | null;
  includeZero?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useHoldings({
  accountId,
  includeZero,
  search,
  sortBy,
  sortOrder,
}: UseHoldingsParams) {
  const [data, setData] = useState<HoldingsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHoldings = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const result = await getHoldings(accountId, { includeZero, search, sortBy, sortOrder });
      setData(result);
    } catch (err) {
      console.error('보유 종목 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId, includeZero, search, sortBy, sortOrder]);

  useEffect(() => {
    void fetchHoldings();
  }, [fetchHoldings]);

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      await refreshAllPrices();
      await fetchHoldings();
    } finally {
      setRefreshing(false);
    }
  };

  const refreshOne = async (tickerOrCode: string) => {
    await refreshStockPrice(tickerOrCode);
    await fetchHoldings();
  };

  const setTicker = async (securityCode: string, tickerCode: string) => {
    if (!accountId || accountId === 'all') return;
    await setHoldingTicker(Number(accountId), securityCode, tickerCode);
    await fetchHoldings();
  };

  return {
    data,
    loading,
    refreshing,
    refetch: fetchHoldings,
    refreshAll,
    refreshOne,
    setTicker,
  };
}
