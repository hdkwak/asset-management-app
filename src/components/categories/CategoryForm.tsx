import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Tag, Briefcase, TrendingUp, PlusCircle, Utensils, Car,
  ShoppingBag, Heart, Music, Smartphone, Zap, DollarSign,
  Home, BookOpen, Coffee, Gift, Globe, Scissors, Bus, Plane,
  Baby, Dog, Dumbbell, Pill, Banknote, BarChart2, Flame,
} from 'lucide-react';
import type { Category } from '../../types';

// ── Icon registry ────────────────────────────────────────────────────────────

const ICON_LIST: { name: string; label: string; Component: LucideIcon }[] = [
  { name: 'tag',         label: '태그',   Component: Tag },
  { name: 'briefcase',   label: '급여',   Component: Briefcase },
  { name: 'trending-up', label: '수익',   Component: TrendingUp },
  { name: 'plus-circle', label: '기타수입', Component: PlusCircle },
  { name: 'utensils',    label: '식비',   Component: Utensils },
  { name: 'car',         label: '자동차', Component: Car },
  { name: 'shopping-bag',label: '쇼핑',   Component: ShoppingBag },
  { name: 'heart',       label: '의료',   Component: Heart },
  { name: 'music',       label: '문화',   Component: Music },
  { name: 'smartphone',  label: '통신',   Component: Smartphone },
  { name: 'zap',         label: '공과금', Component: Zap },
  { name: 'dollar-sign', label: '현금',   Component: DollarSign },
  { name: 'home',        label: '주거',   Component: Home },
  { name: 'book-open',   label: '교육',   Component: BookOpen },
  { name: 'coffee',      label: '카페',   Component: Coffee },
  { name: 'gift',        label: '선물',   Component: Gift },
  { name: 'globe',       label: '여행',   Component: Globe },
  { name: 'scissors',    label: '미용',   Component: Scissors },
  { name: 'bus',         label: '대중교통', Component: Bus },
  { name: 'plane',       label: '항공',   Component: Plane },
  { name: 'baby',        label: '육아',   Component: Baby },
  { name: 'dog',         label: '반려동물', Component: Dog },
  { name: 'dumbbell',    label: '운동',   Component: Dumbbell },
  { name: 'pill',        label: '약',     Component: Pill },
  { name: 'banknote',    label: '저축',   Component: Banknote },
  { name: 'bar-chart-2', label: '투자',   Component: BarChart2 },
  { name: 'flame',       label: '기타',   Component: Flame },
];

export function getIconComponent(name: string) {
  return ICON_LIST.find((i) => i.name === name)?.Component ?? Tag;
}

// ── Color palette ─────────────────────────────────────────────────────────────

const COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#22C55E', '#10B981', '#14B8A6',
  '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
  '#A855F7', '#EC4899', '#F43F5E', '#64748B',
  '#334155', '#0EA5E9', '#D97706', '#059669',
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  category?: Category;
  onSave: (data: Partial<Category>) => Promise<void>;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CategoryForm({ category, onSave, onClose }: Props) {
  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? '#3B82F6');
  const [icon, setIcon] = useState(category?.icon ?? 'tag');
  const [isIncome, setIsIncome] = useState(category ? category.is_income === 1 : false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('카테고리 이름을 입력하세요.'); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), color, icon, is_income: isIncome ? 1 : 0 });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">
            {category ? '카테고리 편집' : '카테고리 추가'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">카테고리명</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 식비"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Income / Expense toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">유형</label>
            <div className="flex gap-2">
              {[
                { label: '지출', value: false },
                { label: '수입', value: true },
              ].map(({ label, value }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setIsIncome(value)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    isIncome === value
                      ? value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-red-500 text-white border-red-500'
                      : 'bg-white text-gray-600 border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">색상</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c ? 'border-gray-700 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Icon */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">아이콘</label>
            <div className="grid grid-cols-9 gap-1">
              {ICON_LIST.map(({ name: iconName, label, Component }) => (
                <button
                  key={iconName}
                  type="button"
                  title={label}
                  onClick={() => setIcon(iconName)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${
                    icon === iconName
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-transparent hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Component size={16} color={icon === iconName ? color : '#6B7280'} />
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: color + '22' }}
            >
              {React.createElement(getIconComponent(icon), { size: 18, color })}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{name || '카테고리명'}</p>
              <p className="text-xs text-gray-400">{isIncome ? '수입' : '지출'}</p>
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-800 rounded-lg hover:bg-blue-900 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
