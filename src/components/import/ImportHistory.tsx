import React, { useEffect, useState } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';
import * as api from '../../api/client';
import type { ImportHistory } from '../../types';

interface Props {
  accountId: number;
}

function StatusBadge({ status, error }: { status: ImportHistory['status']; error: string | null }) {
  if (status === 'success') {
    return <span className="text-green-600 font-medium text-xs">✅ 성공</span>;
  }
  if (status === 'partial') {
    return (
      <span
        className="text-amber-600 font-medium text-xs cursor-help"
        title={error ?? '일부 행 가져오기 실패'}
      >
        ⚠️ 부분
      </span>
    );
  }
  return (
    <span
      className="text-red-600 font-medium text-xs cursor-help"
      title={error ?? '가져오기 실패'}
    >
      ❌ 실패
    </span>
  );
}

function fileTypeBadge(ft: string): string {
  return ft.toUpperCase();
}

export function ImportHistoryPanel({ accountId }: Props) {
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.getImportHistory(accountId)
      .then(setHistory)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [accountId]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('이 기록을 삭제합니까?')) return;
    await api.deleteImportHistory(id);
    load();
  };

  if (loading) {
    return <div className="py-10 text-center text-sm text-gray-400">불러오는 중...</div>;
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-6 px-4 text-red-600 text-sm">
        <AlertCircle size={16} /> {error}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        Import 기록이 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">날짜</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">파일명</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">기관</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">형식</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">신규</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">중복</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">상태</th>
            <th className="px-4 py-3 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {history.map((h) => (
            <tr key={h.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                {h.imported_at.slice(0, 10)}
              </td>
              <td className="px-4 py-3 max-w-[160px] truncate text-gray-700" title={h.filename}>
                {h.filename}
              </td>
              <td className="px-4 py-3 text-gray-700">{h.institution}</td>
              <td className="px-4 py-3 text-center">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                  {fileTypeBadge(h.file_type)}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-medium text-green-700 tabular-nums">
                {h.imported_rows.toLocaleString()}건
              </td>
              <td className="px-4 py-3 text-right text-amber-600 tabular-nums">
                {h.duplicate_rows.toLocaleString()}건
              </td>
              <td className="px-4 py-3 text-center">
                <StatusBadge status={h.status} error={h.error_message} />
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => handleDelete(h.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded"
                  title="삭제"
                >
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
