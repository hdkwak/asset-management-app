import React, { useEffect, useState } from 'react';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import * as api from '../../api/client';
import type { Category } from '../../types';
import { CategoryForm, getIconComponent } from './CategoryForm';

function CategoryIcon({ name, color }: { name: string; color: string }) {
  const Comp = getIconComponent(name);
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: color + '22' }}
    >
      <Comp size={15} color={color} />
    </div>
  );
}

export function CategoryList() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | undefined>(undefined);

  const load = () => {
    setLoading(true);
    api.getCategories()
      .then(setCategories)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: Partial<Category>) => {
    if (editing) {
      await api.updateCategory(editing.id, data);
    } else {
      await api.createCategory(data);
    }
    load();
  };

  const handleDelete = async (cat: Category) => {
    if (!window.confirm(`"${cat.name}" 카테고리를 삭제합니다.\n이미 지정된 거래 내역의 카테고리는 미분류로 변경됩니다.`)) return;
    await api.deleteCategory(cat.id);
    load();
  };

  const income = categories.filter((c) => c.is_income === 1);
  const expense = categories.filter((c) => c.is_income === 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">카테고리 관리</h2>
        <button
          onClick={() => { setEditing(undefined); setFormOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-800 rounded-lg hover:bg-blue-900 transition-colors"
        >
          <PlusCircle size={15} /> 카테고리 추가
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">불러오는 중...</p>
      ) : (
        <>
          <CategorySection
            title="지출 카테고리"
            categories={expense}
            onEdit={(c) => { setEditing(c); setFormOpen(true); }}
            onDelete={handleDelete}
          />
          <CategorySection
            title="수입 카테고리"
            categories={income}
            onEdit={(c) => { setEditing(c); setFormOpen(true); }}
            onDelete={handleDelete}
          />
        </>
      )}

      {formOpen && (
        <CategoryForm
          category={editing}
          onSave={handleSave}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}

function CategorySection({
  title,
  categories,
  onEdit,
  onDelete,
}: {
  title: string;
  categories: Category[];
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</h3>
      {categories.length === 0 ? (
        <p className="text-xs text-gray-400 pl-1">카테고리가 없습니다.</p>
      ) : (
        <div className="space-y-1">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 group"
            >
              <CategoryIcon name={cat.icon} color={cat.color} />
              <span className="flex-1 text-sm text-gray-800">{cat.name}</span>
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onEdit(cat)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded transition-colors"
                  title="편집"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => onDelete(cat)}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                  title="삭제"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
