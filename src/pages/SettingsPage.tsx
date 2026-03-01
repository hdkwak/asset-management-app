import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { CategoryList } from '../components/categories/CategoryList';
import { ProfileList } from '../components/settings/ProfileList';

type Tab = 'categories' | 'profiles';

const TABS: { key: Tab; label: string }[] = [
  { key: 'categories', label: '카테고리 관리' },
  { key: 'profiles',   label: '금융 기관 프로파일' },
];

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('categories');

  return (
    <main className="flex-1 flex flex-col bg-slate-50 overflow-auto min-w-0">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#1E40AF22' }}
          >
            <Settings size={20} style={{ color: '#1E40AF' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">설정</h1>
            <p className="text-sm text-gray-500 mt-0.5">카테고리 및 Import 프로파일을 관리합니다.</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 flex-shrink-0">
        <div className="flex gap-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-6 py-6 overflow-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-3xl">
          {tab === 'categories' && <CategoryList />}
          {tab === 'profiles'   && <ProfileList />}
        </div>
      </div>
    </main>
  );
}
