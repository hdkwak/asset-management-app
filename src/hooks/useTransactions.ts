import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AnyTransaction,
  AccountType,
  CreateTransactionPayload,
  FilterState,
} from '../types';
import * as api from '../api/client';
import { useDebounce } from './useDebounce';

interface UseTransactionsParams {
  accountId?: number | null;
  groupType?: AccountType | null;
  accountType?: AccountType | null;
  filters: FilterState;
  page: number;
  limit?: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export function useTransactions({
  accountId,
  groupType,
  accountType,
  filters,
  page,
  limit = 50,
  sortBy,
  sortOrder,
}: UseTransactionsParams) {
  const [transactions, setTransactions] = useState<AnyTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(page);
  const [loading, setLoading] = useState(false);

  // Debounce search keyword to avoid excessive requests
  const debouncedSearch = useDebounce(filters.search, 350);
  const debouncedFilters: FilterState = { ...filters, search: debouncedSearch };

  const fetchTransactions = useCallback(async () => {
    const hasTarget = accountId || groupType;
    if (!hasTarget) {
      setTransactions([]);
      setTotal(0);
      setTotalPages(0);
      return;
    }
    setLoading(true);
    try {
      const result = await api.getTransactions({
        accountId: accountId ?? undefined,
        group: groupType ?? undefined,
        filters: debouncedFilters,
        page,
        limit,
        sortBy,
        sortOrder,
      });
      setTransactions(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setCurrentPage(result.page);
    } catch (err) {
      console.error('거래 내역 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [
    accountId, groupType,
    debouncedSearch,
    debouncedFilters.dateFrom, debouncedFilters.dateTo,
    debouncedFilters.amountMin, debouncedFilters.amountMax,
    debouncedFilters.categoryId, debouncedFilters.incomeType, debouncedFilters.secType,
    debouncedFilters.securityCode,
    page, limit, sortBy, sortOrder,
  ]);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const addTransaction = async (data: CreateTransactionPayload) => {
    const tx = await api.createTransaction(data);
    await fetchTransactions();
    return tx;
  };

  const editTransaction = async (id: number, data: CreateTransactionPayload) => {
    const tx = await api.updateTransaction(id, data);
    await fetchTransactions();
    return tx;
  };

  const removeTransaction = async (id: number) => {
    if (!accountId || !accountType) return;
    await api.deleteTransaction(id, accountType, accountId);
    await fetchTransactions();
  };

  const bulkRemove = async (ids: number[]) => {
    const type = accountType ?? groupType;
    if (!type) return;
    await api.bulkDeleteTransactions(ids, type, accountId ?? undefined);
    await fetchTransactions();
  };

  return {
    transactions,
    total,
    totalPages,
    currentPage,
    loading,
    fetchTransactions,
    addTransaction,
    editTransaction,
    removeTransaction,
    bulkRemove,
  };
}
