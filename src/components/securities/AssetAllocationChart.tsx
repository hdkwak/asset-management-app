import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { SecurityAllocation } from '../../types';

const CHART_COLORS = [
  '#7C3AED', '#2563EB', '#059669', '#DC2626', '#D97706',
  '#0891B2', '#9333EA', '#16A34A', '#EA580C', '#9CA3AF',
];

function fmtKRW(n: number) {
  return `₩${Math.abs(n).toLocaleString('ko-KR')}`;
}

function pnlColor(n: number) {
  if (n > 0) return '#DC2626';
  if (n < 0) return '#2563EB';
  return '#6B7280';
}

interface TooltipPayload {
  name: string;
  value: number;
  payload: {
    buy_amount: number;
    ratio: number;
    pnl_rate: number;
  };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 mb-1">{d.name}</p>
      <p className="text-gray-600">평가금액: {fmtKRW(d.value)}</p>
      <p className="text-gray-600">매수원금: {fmtKRW(d.payload.buy_amount)}</p>
      <p className="text-gray-600">비중: {d.payload.ratio.toFixed(1)}%</p>
      <p style={{ color: pnlColor(d.payload.pnl_rate) }}>
        수익률: {d.payload.pnl_rate >= 0 ? '+' : ''}{d.payload.pnl_rate.toFixed(2)}%
      </p>
    </div>
  );
}

interface Props {
  data: SecurityAllocation[];
}

export function AssetAllocationChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-center h-[320px]">
        <p className="text-sm text-gray-400">보유 종목이 없습니다.</p>
      </div>
    );
  }

  const top9 = data.slice(0, 9);
  const rest = data.slice(9);
  const otherEval = rest.reduce((s, r) => s + r.eval_amount, 0);
  const otherBuy = rest.reduce((s, r) => s + r.total_buy_amount, 0);
  const otherRatio = rest.reduce((s, r) => s + r.ratio, 0);
  const otherPnlRate =
    otherBuy > 0 ? Math.round(((otherEval - otherBuy) / otherBuy) * 10000) / 100 : 0;

  const chartData = [
    ...top9.map((d) => ({
      name: d.security_name,
      value: d.eval_amount,
      buy_amount: d.total_buy_amount,
      ratio: d.ratio,
      pnl_rate: d.unrealized_pnl_rate,
    })),
    ...(otherEval > 0
      ? [{ name: '기타', value: otherEval, buy_amount: otherBuy, ratio: otherRatio, pnl_rate: otherPnlRate }]
      : []),
  ];

  const totalEval = data.reduce((s, r) => s + r.eval_amount, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">종목별 비중</h3>
      <div className="relative">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="45%"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingBottom: '10%' }}>
          <div className="text-center">
            <p className="text-xs text-gray-400">총 평가금액</p>
            <p className="text-sm font-bold text-gray-900">{fmtKRW(totalEval)}</p>
          </div>
        </div>
      </div>
      {/* Legend */}
      <div className="mt-2 space-y-1 max-h-[100px] overflow-y-auto">
        {chartData.map((d, i) => (
          <div key={d.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="text-gray-700 truncate max-w-[100px]">{d.name}</span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 ml-2">
              <span className="text-gray-500">{d.ratio.toFixed(1)}%</span>
              <span style={{ color: pnlColor(d.pnl_rate) }}>
                {d.pnl_rate >= 0 ? '+' : ''}{d.pnl_rate.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
