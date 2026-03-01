import React from 'react';
import { useSettings } from '../../hooks/useSettings';

const CURRENCY_OPTIONS = [
  { value: 'KRW', label: '원 (₩)' },
  { value: 'USD', label: '달러 ($)' },
  { value: 'EUR', label: '유로 (€)' },
];

const DATE_FORMAT_OPTIONS = [
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
];

export function GeneralSettings() {
  const { settings, loading, updateSetting } = useSettings();

  if (loading) {
    return <p className="text-sm text-gray-400">불러오는 중...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">앱 이름</label>
        <input
          type="text"
          value={settings.app_name ?? 'NsBook 자산관리'}
          onChange={(e) => updateSetting('app_name', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="앱 이름"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">기본 통화</label>
        <select
          value={settings.currency ?? 'KRW'}
          onChange={(e) => updateSetting('currency', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {CURRENCY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">날짜 형식</label>
        <select
          value={settings.date_format ?? 'YYYY-MM-DD'}
          onChange={(e) => updateSetting('date_format', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {DATE_FORMAT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
