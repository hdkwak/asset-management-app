import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { CategoryMonthlyData } from '../../types';

function fmtY(n: number) {
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (Math.abs(n) >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toLocaleString('ko-KR');
}

interface Props {
  data: CategoryMonthlyData[];
}

export function CategoryStackedBar({ data }: Props) {
  const { months, categories, chartData } = useMemo(() => {
    const monthSet = [...new Set(data.map((d) => d.month))].sort();
    const catSet = [...new Set(data.map((d) => d.category_name))];
    const colorMap: Record<string, string> = {};
    data.forEach((d) => { colorMap[d.category_name] = d.color; });

    const rows = monthSet.map((month) => {
      const row: Record<string, string | number> = { month: month.slice(5) };
      catSet.forEach((cat) => {
        const found = data.find((d) => d.month === month && d.category_name === cat);
        row[cat] = found ? Math.abs(found.amount) : 0;
      });
      return row;
    });

    return { months: monthSet, categories: catSet, chartData: rows, colorMap };
  }, [data]);

  const colorMap: Record<string, string> = {};
  data.forEach((d) => { colorMap[d.category_name] = d.color; });

  if (!data.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-center h-[268px]">
        <p className="text-sm text-gray-400">카테고리 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">카테고리별 월간 지출 추이</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} barCategoryGap="30%">
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
            formatter={(value, name) => [
              typeof value === 'number' ? `₩${value.toLocaleString('ko-KR')}` : '-',
              name,
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
          />
          <Legend
            iconType="square"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
          {categories.map((cat) => (
            <Bar
              key={cat}
              dataKey={cat}
              stackId="a"
              fill={colorMap[cat] || '#94A3B8'}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
