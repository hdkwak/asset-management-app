import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { AccountAllocation } from '../../types';

function fmtKRW(n: number) {
  return `₩${Math.abs(n).toLocaleString('ko-KR')}`;
}

interface TooltipPayload {
  name: string;
  value: number;
  payload: { ratio: number };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 mb-1">{d.name}</p>
      <p className="text-gray-600">평가금액: {fmtKRW(d.value)}</p>
      <p className="text-gray-600">비중: {d.payload.ratio.toFixed(1)}%</p>
    </div>
  );
}

interface Props {
  data: AccountAllocation[];
}

export function AccountAllocationChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-center h-[320px]">
        <p className="text-sm text-gray-400">데이터가 없습니다.</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.account_name,
    value: d.eval_amount,
    ratio: d.ratio,
    color: d.account_color,
  }));

  const totalEval = data.reduce((s, r) => s + r.eval_amount, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">계좌별 비중</h3>
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
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color || '#7C3AED'} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingBottom: '10%' }}>
          <div className="text-center">
            <p className="text-xs text-gray-400">계좌</p>
            <p className="text-sm font-bold text-gray-900">{data.length}개</p>
          </div>
        </div>
      </div>
      {/* Legend */}
      <div className="mt-2 space-y-1 max-h-[100px] overflow-y-auto">
        {chartData.map((d) => (
          <div key={d.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-gray-700 truncate max-w-[120px]">{d.name}</span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 ml-2">
              <span className="text-gray-500">{d.ratio.toFixed(1)}%</span>
              <span className="text-gray-700 tabular-nums">{fmtKRW(d.value)}</span>
            </div>
          </div>
        ))}
      </div>
      {data.length > 1 && (
        <p className="text-xs text-gray-400 mt-2 text-right">총 {fmtKRW(totalEval)}</p>
      )}
    </div>
  );
}
