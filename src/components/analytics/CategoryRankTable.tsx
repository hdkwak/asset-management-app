import React from 'react';
import type { ByCategoryData } from '../../types';
import { getIconComponent } from '../categories/CategoryForm';

interface Props {
  data: ByCategoryData[];
}

export function CategoryRankTable({ data }: Props) {
  if (!data.length) {
    return <p className="text-sm text-gray-400 py-4">지출 데이터가 없습니다.</p>;
  }

  const top = data.slice(0, 10);
  const maxAmount = Math.abs(top[0].amount);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">카테고리 지출 순위</h3>
      <div className="space-y-2">
        {top.map((cat, i) => {
          const Icon = getIconComponent(cat.icon ?? 'tag');
          const amt = Math.abs(cat.amount);
          const barWidth = maxAmount > 0 ? (amt / maxAmount) * 100 : 0;
          return (
            <div key={cat.category_id} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: cat.color + '22' }}
              >
                <Icon size={12} color={cat.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-gray-700 truncate">{cat.category_name}</span>
                  <span className="text-xs font-medium text-red-600 tabular-nums ml-2 flex-shrink-0">
                    ₩{amt.toLocaleString('ko-KR')}
                  </span>
                </div>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${barWidth}%`, backgroundColor: cat.color }}
                  />
                </div>
              </div>
              <span className="text-xs text-gray-400 w-10 text-right flex-shrink-0">
                {cat.ratio.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
