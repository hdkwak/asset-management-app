import React from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import type { PnlRanking } from '../../types';

function fmtKRW(n: number) {
  const sign = n >= 0 ? '+' : '-';
  return `${sign}₩${Math.abs(n).toLocaleString('ko-KR')}`;
}

function fmtKRWAbs(n: number) {
  return `₩${Math.abs(n).toLocaleString('ko-KR')}`;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  // recharts v3 may spread data fields directly into payload[0]; fallback to .payload for v2
  const d: PnlRanking = payload[0].payload ?? payload[0];
  if (!d?.security_name) return null;
  const rate = d.unrealized_pnl_rate ?? 0;
  const pnl = d.unrealized_pnl ?? 0;
  const color = rate > 0 ? '#DC2626' : rate < 0 ? '#2563EB' : '#6B7280';
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs min-w-[180px]">
      <p className="font-semibold text-gray-900 mb-1 truncate max-w-[220px]">{d.security_name}</p>
      <p style={{ color }}>수익률: {rate >= 0 ? '+' : ''}{rate.toFixed(2)}%</p>
      <p style={{ color }}>평가손익: {fmtKRW(pnl)}</p>
      <p className="text-gray-500">평가금액: {fmtKRWAbs(d.eval_amount)}</p>
      <p className="text-gray-500">매수원금: {fmtKRWAbs(d.total_buy_amount)}</p>
    </div>
  );
}

interface Props {
  data: PnlRanking[];
}

export function PnlRankingChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-center h-[320px]">
        <p className="text-sm text-gray-400">보유 종목이 없습니다.</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({ ...d }));

  const chartHeight = Math.max(220, chartData.length * 28 + 40);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">수익률 랭킹</h3>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 4, right: 32, left: 4, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
          <XAxis
            type="number"
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="security_name"
            width={90}
            tick={(props: any) => {
              const label: string = props.payload?.value ?? '';
              const display = label.length > 10 ? label.slice(0, 10) + '…' : label;
              return (
                <text x={props.x} y={props.y} dy={4} textAnchor="end" fontSize={10} fill="#4B5563">
                  {display}
                </text>
              );
            }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={(props) => <CustomTooltip active={props.active} payload={props.payload as any} />} />
          <ReferenceLine x={0} stroke="#D1D5DB" />
          <Bar dataKey="unrealized_pnl_rate" name="수익률" radius={[0, 3, 3, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.unrealized_pnl_rate > 0 ? '#DC2626' : '#2563EB'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
