import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { MonthlyDividend } from '../../types';

function fmtKRW(n: number) {
  return `₩${Math.abs(n).toLocaleString('ko-KR')}`;
}

function fmtY(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 100_000_000) return `${(n / 100_000_000).toFixed(0)}억`;
  if (abs >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toLocaleString('ko-KR');
}

interface TooltipPayload {
  value: number;
  payload: { month: string };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{d.payload.month}</p>
      <p className="text-green-700">배당금: {fmtKRW(d.value)}</p>
    </div>
  );
}

interface Props {
  data: MonthlyDividend[];
}

export function DividendChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-center h-[320px]">
        <p className="text-sm text-gray-400">배당 내역이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">월별 배당금</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
          <XAxis
            dataKey="month"
            tickFormatter={(v: string) => v.slice(5)}
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={fmtY}
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="amount" fill="#16A34A" radius={[3, 3, 0, 0]} name="배당금" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
