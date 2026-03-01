import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { ByCategoryData } from '../../types';

const FALLBACK_COLORS = [
  '#3B82F6', '#EF4444', '#F97316', '#10B981',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B',
];

function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

interface Props {
  data: ByCategoryData[];
}

export function CategoryDonutChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-center h-[300px]">
        <p className="text-sm text-gray-400">지출 데이터가 없습니다.</p>
      </div>
    );
  }

  // Keep top 7, group rest as "기타"
  const top = data.slice(0, 7);
  const rest = data.slice(7);
  const otherAmount = rest.reduce((s, d) => s + Math.abs(d.amount), 0);
  const otherRatio = rest.reduce((s, d) => s + d.ratio, 0);

  const chartData = [
    ...top.map((d) => ({
      name: d.category_name,
      value: Math.abs(d.amount),
      color: d.color,
      ratio: d.ratio,
    })),
    ...(otherAmount > 0
      ? [{ name: '기타', value: otherAmount, color: '#CBD5E1', ratio: otherRatio }]
      : []),
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">카테고리별 지출</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name, props) => [
              typeof value === 'number'
                ? `₩${value.toLocaleString('ko-KR')} (${pct(props.payload.ratio)})`
                : '-',
              name,
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
