import React, { useState } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import type { PortfolioHistoryPoint } from '../../types';

const PERIODS = ['1개월', '3개월', '6개월', '1년', '전체'] as const;
type Period = typeof PERIODS[number];

function fmtKRW(n: number) {
  return `₩${Math.abs(n).toLocaleString('ko-KR')}`;
}

function fmtY(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 100_000_000) return `${(n / 100_000_000).toFixed(0)}억`;
  if (abs >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toLocaleString('ko-KR');
}

function fmtDate(d: string): string {
  return d.slice(5); // MM-DD
}

function filterByPeriod(data: PortfolioHistoryPoint[], period: Period): PortfolioHistoryPoint[] {
  if (period === '전체' || data.length === 0) return data;
  const monthMap: Record<string, number> = {
    '1개월': 1, '3개월': 3, '6개월': 6, '1년': 12,
  };
  const months = monthMap[period] ?? 12;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return data.filter((d) => d.date >= cutoffStr);
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; dataKey: string }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const evalAmt = payload.find((p) => p.dataKey === 'eval_amount')?.value ?? 0;
  const buyAmt = payload.find((p) => p.dataKey === 'buy_amount')?.value ?? 0;
  const pnl = evalAmt - buyAmt;
  const pnlRate = buyAmt > 0 ? ((pnl / buyAmt) * 100) : 0;
  const pnlColor = pnl > 0 ? '#DC2626' : pnl < 0 ? '#2563EB' : '#6B7280';

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-gray-600">평가금액: {fmtKRW(evalAmt)}</p>
      <p className="text-gray-500">매수원금: {fmtKRW(buyAmt)}</p>
      <p style={{ color: pnlColor }}>
        손익: {pnl >= 0 ? '+' : ''}{fmtKRW(pnl)} ({pnlRate >= 0 ? '+' : ''}{pnlRate.toFixed(2)}%)
      </p>
    </div>
  );
}

interface Props {
  data: PortfolioHistoryPoint[];
}

export function PortfolioHistoryChart({ data }: Props) {
  const [period, setPeriod] = useState<Period>('전체');
  const filtered = filterByPeriod(data, period);

  if (!data.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-center h-[280px]">
        <p className="text-sm text-gray-400">거래 내역이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">포트폴리오 추이</h3>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                period === p
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-[220px]">
          <p className="text-sm text-gray-400">해당 기간의 데이터가 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-2 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-purple-600 inline-block" />
              평가금액
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-gray-400 inline-block border-dashed" style={{ borderBottom: '2px dashed #9CA3AF' }} />
              매수원금
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={filtered} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={fmtY}
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="eval_amount"
                fill="#7C3AED"
                fillOpacity={0.15}
                stroke="#7C3AED"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="buy_amount"
                stroke="#9CA3AF"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
