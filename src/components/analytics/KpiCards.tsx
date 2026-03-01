import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { BankAnalyticsResponse } from '../../types';

function fmt(n: number) {
  return `₩${Math.abs(n).toLocaleString('ko-KR')}`;
}

function pctLabel(pct: number) {
  if (!isFinite(pct) || pct === 0) return null;
  const up = pct > 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${up ? 'text-red-500' : 'text-blue-500'}`}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

interface Props {
  summary: BankAnalyticsResponse['summary'];
  month: number | null; // null = all-year
}

export function KpiCards({ summary, month }: Props) {
  const { thisMonth, incomeChange, expenseChange } = summary;

  const daysInPeriod = month
    ? new Date(new Date().getFullYear(), month, 0).getDate()
    : 365;
  const avgDailyExpense =
    thisMonth.expense !== 0 ? Math.abs(thisMonth.expense) / daysInPeriod : 0;

  const cards = [
    {
      label: month ? '이번달 수입' : '기간 수입',
      value: fmt(thisMonth.income),
      sign: '+',
      signColor: 'text-blue-600',
      sub: pctLabel(incomeChange),
      border: 'border-blue-100',
      bg: 'bg-blue-50',
    },
    {
      label: month ? '이번달 지출' : '기간 지출',
      value: fmt(Math.abs(thisMonth.expense)),
      sign: '-',
      signColor: 'text-red-600',
      sub: pctLabel(-expenseChange), // inverted: expense increase = bad
      border: 'border-red-100',
      bg: 'bg-red-50',
    },
    {
      label: month ? '이번달 순수익' : '기간 순수익',
      value: fmt(thisMonth.net),
      sign: thisMonth.net >= 0 ? '+' : '-',
      signColor: thisMonth.net >= 0 ? 'text-blue-600' : 'text-red-600',
      sub: null,
      border: 'border-green-100',
      bg: 'bg-green-50',
    },
    {
      label: '평균 일지출',
      value: fmt(avgDailyExpense),
      sign: '',
      signColor: 'text-gray-600',
      sub: null,
      border: 'border-gray-100',
      bg: 'bg-gray-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-xl border ${c.border} ${c.bg} px-4 py-4`}
        >
          <p className="text-xs text-gray-500 mb-1">{c.label}</p>
          <p className={`text-xl font-bold tabular-nums ${c.signColor}`}>
            {c.sign}{c.value}
          </p>
          {c.sub && <div className="mt-1">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}
