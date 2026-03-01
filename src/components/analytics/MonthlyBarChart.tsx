import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { MonthlyData } from '../../types';

function fmtY(n: number) {
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (Math.abs(n) >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toLocaleString('ko-KR');
}

function fmtTooltip(value: number) {
  return `₩${Math.abs(value).toLocaleString('ko-KR')}`;
}

interface Props {
  data: MonthlyData[];
}

export function MonthlyBarChart({ data }: Props) {
  const chartData = data.map((d) => ({
    month: d.month.slice(5), // "MM"
    수입: d.income,
    지출: Math.abs(d.expense),
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">월별 수입·지출</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} barGap={2} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={fmtY}
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            formatter={(value) => [typeof value === 'number' ? fmtTooltip(value) : '-']}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            iconType="square"
            iconSize={10}
          />
          <Bar dataKey="수입" fill="#2563EB" radius={[4, 4, 0, 0]} />
          <Bar dataKey="지출" fill="#EF4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
