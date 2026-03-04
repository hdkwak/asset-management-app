import { useState, useEffect, useCallback } from 'react';
import { getSecuritiesAnalytics } from '../api/client';
import type { SecuritiesAnalyticsResponse } from '../types';

interface Params {
  accountId: number | 'all';
}

export function useSecuritiesAnalytics({ accountId }: Params) {
  const [data, setData] = useState<SecuritiesAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSecuritiesAnalytics({ account_id: accountId });
      setData(result);
    } catch (err) {
      console.error('증권 분석 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, refetch };
}
