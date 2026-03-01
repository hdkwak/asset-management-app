import React, { useEffect, useState } from 'react';
import { PlusCircle, Pencil, Trash2, Copy } from 'lucide-react';
import * as api from '../../api/client';
import type { InstitutionProfile } from '../../types';
import { ProfileForm } from './ProfileForm';

export function ProfileList() {
  const [profiles, setProfiles] = useState<InstitutionProfile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'copy' | null>(null);
  const [selected, setSelected] = useState<InstitutionProfile | undefined>(undefined);

  const load = () => {
    setLoading(true);
    api.getProfiles()
      .then(setProfiles)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: Partial<InstitutionProfile>) => {
    if (formMode === 'edit' && selected) {
      await api.updateProfile(selected.id, data);
    } else {
      await api.createProfile(data);
    }
    load();
  };

  const handleDelete = async (p: InstitutionProfile) => {
    if (!window.confirm(`"${p.institution}" 프로파일을 삭제합니까?`)) return;
    await api.deleteProfile(p.id);
    load();
  };

  const presets  = profiles.filter((p) => p.is_preset === 1);
  const customs  = profiles.filter((p) => p.is_preset === 0);

  const colMapPreview = (raw: string) => {
    try {
      const obj = JSON.parse(raw) as Record<string, string>;
      return Object.values(obj).filter(Boolean).slice(0, 3).join(', ');
    } catch { return ''; }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">금융 기관 프로파일</h2>
        <button
          onClick={() => { setSelected(undefined); setFormMode('create'); }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-800 rounded-lg hover:bg-blue-900 transition-colors"
        >
          <PlusCircle size={15} /> 프로파일 추가
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">불러오는 중...</p>
      ) : (
        <>
          <ProfileSection
            title="사전 등록 프로파일"
            badge="사전 등록"
            badgeColor="bg-slate-100 text-slate-600"
            profiles={presets}
            colMapPreview={colMapPreview}
            readonly
            onCopy={(p) => { setSelected(p); setFormMode('copy'); }}
          />
          <ProfileSection
            title="커스텀 프로파일"
            badge="커스텀"
            badgeColor="bg-blue-100 text-blue-700"
            profiles={customs}
            colMapPreview={colMapPreview}
            onEdit={(p) => { setSelected(p); setFormMode('edit'); }}
            onDelete={handleDelete}
          />
        </>
      )}

      {formMode && (
        <ProfileForm
          profile={formMode === 'edit' ? selected : undefined}
          copyFrom={formMode === 'copy' ? selected : undefined}
          onSave={handleSave}
          onClose={() => { setFormMode(null); setSelected(undefined); }}
        />
      )}
    </div>
  );
}

function ProfileSection({
  title, badge, badgeColor, profiles, colMapPreview, readonly = false,
  onEdit, onDelete, onCopy,
}: {
  title: string;
  badge: string;
  badgeColor: string;
  profiles: InstitutionProfile[];
  colMapPreview: (raw: string) => string;
  readonly?: boolean;
  onEdit?: (p: InstitutionProfile) => void;
  onDelete?: (p: InstitutionProfile) => void;
  onCopy?: (p: InstitutionProfile) => void;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</h3>
      {profiles.length === 0 ? (
        <p className="text-xs text-gray-400 pl-1">프로파일이 없습니다.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-800">{p.institution}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badgeColor}`}>
                    {badge}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                    {(p.file_type || 'csv').toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-400">
                    {p.account_type === 'bank' ? '은행' : '증권'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  컬럼: {colMapPreview(p.column_map)}…
                  {p.notes && <span className="ml-2 italic">{p.notes}</span>}
                </p>
              </div>
              <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {onCopy && (
                  <button onClick={() => onCopy(p)} title="복사하여 커스텀 생성"
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                    <Copy size={13} />
                  </button>
                )}
                {!readonly && onEdit && (
                  <button onClick={() => onEdit(p)} title="편집"
                    className="p-1.5 text-gray-400 hover:text-gray-700 rounded">
                    <Pencil size={13} />
                  </button>
                )}
                {!readonly && onDelete && (
                  <button onClick={() => onDelete(p)} title="삭제"
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
