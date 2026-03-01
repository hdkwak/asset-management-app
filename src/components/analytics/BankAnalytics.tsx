import React, { useEffect, useState } from 'react';
import { BarChart2 } from 'lucide-react';
import * as api from '../../api/client';
import type { Account, BankAnalyticsResponse } from '../../types';
import { KpiCards } from './KpiCards';
import { MonthlyBarChart } from './MonthlyBarChart';
import { BalanceLineChart } from './BalanceLineChart';
import { CategoryDonutChart } from './CategoryDonutChart';
import { CategoryStackedBar } from './CategoryStackedBar';
import { CategoryRankTable } from './CategoryRankTable';

interface Props {
  accounts: Account[];
}

const MONTHS = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월',
];

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1;
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export function BankAnalytics({ accounts }: Props) {
  const bankAccounts = accounts.filter((a) => a.type === 'bank');

  const [accountId, setAccountId] = useState<number | 'all'>('all');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState<number>(CURRENT_MONTH);
  const [data, setData] = useState<BankAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.getBankAnalytics({ accountId, year, month })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [accountId, year, month]);

  return (
    <main className="flex-1 flex flex-col bg-slate-50 overflow-auto min-w-0">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#1E40AF22' }}
          >
            <BarChart2 size={20} style={{ color: '#1E40AF' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">수입·지출 분석</h1>
            <p className="text-sm text-gray-500 mt-0.5">은행 계좌 기준 수입·지출 현황을 분석합니다.</p>
          </div>
        </div>
      </header>

      {/* Filter bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3 flex-shrink-0">
        {/* Account selector */}
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">전체 은행</option>
          {bankAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        {/* Year selector */}
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>

        {/* Month selector */}
        <div className="flex gap-1 flex-wrap">
          {MONTHS.map((label, i) => {
            const m = i + 1;
            return (
              <button
                key={m}
                onClick={() => setMonth(m)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  month === m
                    ? 'bg-blue-800 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 space-y-4 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            로딩 중...
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {data && !loading && (
          <>
            {/* KPI Cards */}
            <KpiCards summary={data.summary} month={month} />

            {/* Row 1: Monthly + Balance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <MonthlyBarChart data={data.monthly} />
              <BalanceLineChart data={data.dailyBalance} />
            </div>

            {/* Row 2: Donut + Rank */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CategoryDonutChart data={data.byCategory} />
              <CategoryRankTable data={data.byCategory} />
            </div>

            {/* Row 3: Stacked bar full width */}
            <CategoryStackedBar data={data.categoryMonthly} />
          </>
        )}
      </div>
    </main>
  );
}
