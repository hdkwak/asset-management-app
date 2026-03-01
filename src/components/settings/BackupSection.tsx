import React, { useState } from 'react';
import { Download, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import { exportBackup, importBackup } from '../../api/client';
import { saveAs } from 'file-saver';
import type { BackupData, RestoreStats } from '../../types';
import { useToast } from '../common/Toast';

export function BackupSection() {
  const { addToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [restoreStats, setRestoreStats] = useState<RestoreStats | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<BackupData | null>(null);
  const [restoring, setRestoring] = useState(false);

  // ── Export ────────────────────────────────────────────────────────────────────

  async function handleExport() {
    setExporting(true);
    try {
      const data = await exportBackup();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const dateStr = new Date().toISOString().slice(0, 10);
      saveAs(blob, `nsbook-backup-${dateStr}.json`);
      addToast('백업 파일이 저장되었습니다.', 'success');
    } catch (err) {
      addToast(`백업 실패: ${(err as Error).message}`, 'error');
    } finally {
      setExporting(false);
    }
  }

  // ── Import ────────────────────────────────────────────────────────────────────

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as BackupData;
        if (data.version !== 1) throw new Error('지원하지 않는 백업 버전입니다.');
        setPendingData(data);
        setConfirmOpen(true);
        setRestoreStats(null);
      } catch (err) {
        addToast(`파일 읽기 오류: ${(err as Error).message}`, 'error');
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  }

  async function handleConfirmRestore() {
    if (!pendingData) return;
    setRestoring(true);
    try {
      const result = await importBackup(pendingData);
      setRestoreStats(result.stats);
      addToast('데이터 복원이 완료되었습니다. 페이지를 새로고침하세요.', 'success');
    } catch (err) {
      addToast(`복원 실패: ${(err as Error).message}`, 'error');
    } finally {
      setRestoring(false);
      setConfirmOpen(false);
      setPendingData(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">데이터 백업</h3>
        <p className="text-sm text-gray-500 mb-3">
          모든 계좌, 거래내역, 카테고리를 JSON 파일로 내보냅니다.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          <Download size={16} />
          {exporting ? '내보내는 중...' : '백업 파일 다운로드'}
        </button>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">데이터 복원</h3>
        <p className="text-sm text-gray-500 mb-3">
          백업 JSON 파일을 선택하면 기존 데이터에 병합됩니다. (중복 항목은 무시됩니다)
        </p>
        <label className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 cursor-pointer w-fit transition-colors">
          <Upload size={16} />
          백업 파일 선택
          <input type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
        </label>

        {restoreStats && (
          <div className="mt-4 flex items-start gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-800">
              <p className="font-medium mb-1">복원 완료</p>
              <ul className="space-y-0.5 text-xs">
                <li>계좌: {restoreStats.accounts}개</li>
                <li>카테고리: {restoreStats.categories}개</li>
                <li>은행 거래: {restoreStats.bankTx}건</li>
                <li>증권 거래: {restoreStats.securitiesTx}건</li>
                <li>프로파일: {restoreStats.profiles}개</li>
              </ul>
              <p className="mt-2 text-xs text-green-600">페이지를 새로고침하면 반영됩니다.</p>
            </div>
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      {confirmOpen && pendingData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={22} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">데이터 복원 확인</h3>
                <p className="text-sm text-gray-600">
                  백업 파일({new Date(pendingData.exportedAt).toLocaleDateString('ko-KR')})을 복원합니다.
                  기존 데이터와 병합되며, 중복 항목은 건너뜁니다.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setConfirmOpen(false); setPendingData(null); }}
                disabled={restoring}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={restoring}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {restoring ? '복원 중...' : '복원'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
