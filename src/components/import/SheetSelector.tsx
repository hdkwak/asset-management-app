import React, { useState } from 'react';
import type { SheetInfo } from '../../api/client';

const HEADER_ROW_OPTIONS: { label: string; value: number }[] = [
  { label: '자동 감지', value: -1 },
  { label: '1행', value: 0 },
  { label: '2행', value: 1 },
  { label: '3행', value: 2 },
  { label: '4행', value: 3 },
];

interface Props {
  sheets: SheetInfo[];
  onConfirm: (sheetIndex: number, headerRow: number) => void;
  onBack: () => void;
}

export function SheetSelector({ sheets, onConfirm, onBack }: Props) {
  // Default to sheet with most rows
  const recommendedIdx = sheets.reduce(
    (best, s, i) => (s.rowCount > sheets[best].rowCount ? i : best),
    0
  );

  const [selectedIdx, setSelectedIdx] = useState(recommendedIdx);
  const [headerRow, setHeaderRow] = useState(-1);

  return (
    <div className="px-6 py-5 space-y-5">
      <p className="text-sm text-gray-600">
        이 파일에는 여러 시트가 있습니다. 가져올 시트를 선택하세요.
      </p>

      {/* Sheet list */}
      <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
        {sheets.map((sheet, i) => (
          <label
            key={i}
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
              selectedIdx === i ? 'bg-blue-50' : 'hover:bg-gray-50'
            }`}
          >
            <input
              type="radio"
              name="sheet"
              checked={selectedIdx === i}
              onChange={() => setSelectedIdx(i)}
              className="text-blue-600"
            />
            <span className="flex-1 text-sm font-medium text-gray-800">{sheet.name}</span>
            <span className="text-xs text-gray-400 tabular-nums">{sheet.rowCount.toLocaleString()}행</span>
            {i === recommendedIdx && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                추천
              </span>
            )}
          </label>
        ))}
      </div>

      {/* Header row */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">헤더 행</label>
        <select
          value={headerRow}
          onChange={(e) => setHeaderRow(Number(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {HEADER_ROW_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">
          '자동 감지'를 선택하면 시스템이 헤더 행을 자동으로 탐지합니다.
        </p>
      </div>

      {/* Actions — rendered outside in ImportModal footer, so just expose via onConfirm/onBack */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          이전
        </button>
        <button
          type="button"
          onClick={() => onConfirm(selectedIdx, headerRow)}
          className="px-5 py-2 text-sm font-medium text-white bg-blue-800 rounded-lg hover:bg-blue-900"
        >
          다음 →
        </button>
      </div>
    </div>
  );
}
