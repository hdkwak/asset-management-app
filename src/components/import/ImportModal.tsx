import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, ChevronRight, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { AccountType, InstitutionProfile, ParsedRow } from '../../types';
import * as api from '../../api/client';
import type { SheetInfo } from '../../api/client';
import { SheetSelector } from './SheetSelector';

// Standard fields by account type
const BANK_FIELDS: { key: string; label: string; required: boolean }[] = [
  { key: 'date',       label: '날짜',           required: true },
  { key: 'payee',      label: '거래처',          required: false },
  { key: 'amount_in',  label: '입금 금액 (수입)', required: false },
  { key: 'amount_out', label: '출금 금액 (지출)', required: false },
  { key: 'amount',     label: '금액 (±부호)',    required: false },
  { key: 'balance',    label: '거래 후 잔고',    required: false },
  { key: 'note',       label: '메모',            required: false },
];

const SECURITIES_FIELDS: { key: string; label: string; required: boolean }[] = [
  { key: 'date',          label: '날짜',              required: true },
  { key: 'amount_in',     label: '입금/입고 금액',    required: false },
  { key: 'amount_out',    label: '출금/출고 금액',    required: false },
  { key: 'amount',        label: '거래 금액 (±부호)', required: false },
  { key: 'balance',       label: '잔고',              required: false },
  { key: 'type',          label: '거래 유형',         required: false },
  { key: 'security',      label: '종목명',            required: false },
  { key: 'security_code', label: '종목코드',          required: false },
  { key: 'quantity',      label: '수량',              required: false },
  { key: 'unit_price',    label: '단가',              required: false },
  { key: 'description',   label: '거래 내용',         required: false },
];

type Step = 'setup' | 'sheets' | 'mapping' | 'preview' | 'done';

interface Props {
  accountId: number;
  accountType: AccountType;
  institution: string;
  onClose: () => void;
  onImported: () => void;
}

export function ImportModal({ accountId, accountType, institution, onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>('setup');
  const [file, setFile] = useState<File | null>(null);
  const [selectedInstitution, setSelectedInstitution] = useState(institution);
  const [profiles, setProfiles] = useState<InstitutionProfile[]>([]);
  const [encoding, setEncoding] = useState('auto');

  // Sheet step state
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(-1);

  // Mapping step state
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [amountSign, setAmountSign] = useState<'separate' | 'signed'>('separate');
  const [saveProfile, setSaveProfile] = useState(false);
  const [customInstitution, setCustomInstitution] = useState('');

  // Preview step state
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [total, setTotal] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [dupCount, setDupCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [detectedEncoding, setDetectedEncoding] = useState('');
  const [showMappingDetail, setShowMappingDetail] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<{ institution: string; profileId: number } | null>(null);

  // Done step state
  const [savedCount, setSavedCount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getProfiles(accountType).then(setProfiles).catch(console.error);
  }, [accountType]);

  const stdFields = accountType === 'bank' ? BANK_FIELDS : SECURITIES_FIELDS;
  const isExcel = (f: File | null) => {
    const ext = (f?.name.split('.').pop() ?? '').toLowerCase();
    return ext === 'xls' || ext === 'xlsx';
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  // Step 1: Analyze — for Excel, first fetch sheet list
  const handleAnalyze = async () => {
    if (!file) { setError('파일을 선택하세요.'); return; }
    setLoading(true);
    setError('');
    try {
      if (isExcel(file)) {
        const fd = new FormData();
        fd.append('file', file);
        const { sheets: sheetInfos } = await api.getSheetsFromFile(fd);
        if (sheetInfos.length > 1) {
          setSheets(sheetInfos);
          setStep('sheets');
          return;
        }
        // Single sheet — proceed directly
        setSheetIndex(0);
        await runPreview(0, -1);
      } else {
        await runPreview(0, -1);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Sheet step: user confirmed a sheet + header row
  const handleSheetConfirm = async (idx: number, hRow: number) => {
    setSheetIndex(idx);
    setHeaderRow(hRow);
    setLoading(true);
    setError('');
    try {
      await runPreview(idx, hRow);
    } catch (err) {
      setError((err as Error).message);
      setStep('sheets');
    } finally {
      setLoading(false);
    }
  };

  const runPreview = async (sIdx: number, hRow: number) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('account_id', String(accountId));
    fd.append('account_type', accountType);
    fd.append('institution', selectedInstitution);
    fd.append('encoding', encoding);
    fd.append('sheet_index', String(sIdx));
    fd.append('header_row', String(hRow));

    const result = await api.previewImport(fd);
    setDetectedEncoding(result.detectedEncoding ?? '');
    setCurrentProfile(result.profileMatch);

    if (result.needsMapping) {
      setHeaders(result.headers);
      setSampleRows(result.sampleRows);
      setStep('mapping');
    } else {
      setPreviewRows(result.rows ?? []);
      setTotal(result.total ?? 0);
      setNewCount(result.newCount ?? 0);
      setDupCount(result.duplicateCount ?? 0);
      setSkippedCount(result.skippedCount ?? 0);
      setStep('preview');
    }
  };

  const handleMappingSubmit = async () => {
    if (!file) return;
    if (!columnMapping['date']) { setError('날짜 컬럼을 선택하세요.'); return; }
    if (accountType === 'securities') {
      const hasAmount = columnMapping['amount'] || columnMapping['amount_in'] || columnMapping['amount_out'];
      if (!hasAmount) { setError('거래 금액 컬럼을 선택하세요. (단일 금액 또는 입금/출금 분리 컬럼 중 하나를 매핑하세요.)'); return; }
    }

    setLoading(true);
    setError('');
    try {
      if (saveProfile && (customInstitution || selectedInstitution !== '직접 입력')) {
        const instName = selectedInstitution === '직접 입력' ? customInstitution : selectedInstitution;
        if (instName) {
          await api.createProfile({
            institution: instName,
            account_type: accountType,
            encoding,
            column_map: JSON.stringify(columnMapping),
            amount_sign: amountSign,
          });
        }
      }

      const fd = new FormData();
      fd.append('file', file);
      fd.append('account_id', String(accountId));
      fd.append('account_type', accountType);
      fd.append('institution', selectedInstitution);
      fd.append('column_mapping', JSON.stringify(columnMapping));
      fd.append('amount_sign', amountSign);
      fd.append('encoding', encoding);
      fd.append('sheet_index', String(sheetIndex));
      fd.append('header_row', String(headerRow));

      const result = await api.previewImport(fd);
      setDetectedEncoding(result.detectedEncoding ?? '');
      setPreviewRows(result.rows ?? []);
      setTotal(result.total ?? 0);
      setNewCount(result.newCount ?? 0);
      setDupCount(result.duplicateCount ?? 0);
      setSkippedCount(result.skippedCount ?? 0);
      setStep('preview');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    const newRows = previewRows.filter((r) => !r.isDuplicate);
    if (!newRows.length) { onClose(); return; }

    setLoading(true);
    setError('');
    try {
      const result = await api.confirmImport({
        account_id: accountId,
        account_type: accountType,
        rows: newRows,
        filename: file?.name ?? '',
        institution: selectedInstitution,
        total_rows: total,
        duplicate_rows: dupCount,
        skipped_rows: skippedCount,
      });
      setSavedCount(result.saved);
      setStep('done');
      onImported();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  const ALL_STEPS: Step[] = ['setup', 'sheets', 'mapping', 'preview', 'done'];
  const VISIBLE_STEPS: Step[] = sheets.length > 1
    ? ['setup', 'sheets', 'mapping', 'preview', 'done']
    : ['setup', 'mapping', 'preview', 'done'];
  const STEP_LABELS: Record<Step, string> = {
    setup: '파일 선택', sheets: '시트 선택', mapping: '컬럼 매핑', preview: '미리보기', done: '완료',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">거래 내역 Import</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 py-3 bg-gray-50 border-b flex-shrink-0 overflow-x-auto">
          {VISIBLE_STEPS.map((s, i) => {
            const active = s === step;
            const doneIdx = VISIBLE_STEPS.indexOf(step);
            const done = doneIdx > i;
            return (
              <React.Fragment key={s}>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                  active ? 'bg-blue-600 text-white' : done ? 'bg-green-100 text-green-700' : 'text-gray-400'
                }`}>
                  {STEP_LABELS[s]}
                </span>
                {i < VISIBLE_STEPS.length - 1 && <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Step: Setup ── */}
          {step === 'setup' && (
            <div className="px-6 py-5 space-y-5">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  file ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }`}
              >
                <Upload size={32} className={`mx-auto mb-2 ${file ? 'text-blue-500' : 'text-gray-400'}`} />
                {file ? (
                  <p className="text-blue-600 font-medium text-sm">{file.name}</p>
                ) : (
                  <>
                    <p className="text-gray-600 text-sm font-medium">파일을 드래그하거나 클릭하여 선택</p>
                    <p className="text-gray-400 text-xs mt-1">CSV, XLS, XLSX, PDF · 최대 50MB</p>
                  </>
                )}
                <input ref={fileInputRef} type="file" accept=".csv,.xls,.xlsx,.pdf" className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">금융 기관</label>
                <select value={selectedInstitution} onChange={(e) => setSelectedInstitution(e.target.value)} className={inputCls}>
                  <option value="직접 입력">직접 입력 (컬럼 직접 매핑)</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.institution}>
                      {p.institution}{p.is_preset ? '' : ' (사용자 정의)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Encoding selector — only for CSV */}
              {file && !isExcel(file) && !file.name.toLowerCase().endsWith('.pdf') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">인코딩</label>
                  <select value={encoding} onChange={(e) => setEncoding(e.target.value)} className={inputCls}>
                    <option value="auto">자동 감지 (권장)</option>
                    <option value="utf-8">UTF-8</option>
                    <option value="euc-kr">EUC-KR (한국 은행 구형)</option>
                  </select>
                </div>
              )}

              {error && <p className="text-red-500 text-sm flex items-center gap-1"><AlertCircle size={14} />{error}</p>}
            </div>
          )}

          {/* ── Step: Sheets ── */}
          {step === 'sheets' && (
            <SheetSelector
              sheets={sheets}
              onConfirm={handleSheetConfirm}
              onBack={() => setStep('setup')}
            />
          )}

          {/* ── Step: Mapping ── */}
          {step === 'mapping' && (
            <div className="px-6 py-5 space-y-5">
              <div className="flex items-start gap-2">
                <p className="text-sm text-gray-600 flex-1">
                  파일에서 감지된 컬럼을 표준 필드에 매핑하세요.
                  <span className="text-gray-400 ml-1">(파일: {file?.name})</span>
                </p>
                {detectedEncoding && (
                  <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded px-2 py-1 whitespace-nowrap flex-shrink-0">
                    <Info size={11} /> {detectedEncoding}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {stdFields.map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <select
                      value={columnMapping[f.key] ?? ''}
                      onChange={(e) => setColumnMapping((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">선택 안 함</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {accountType === 'bank' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">금액 방식</label>
                  <div className="flex gap-3">
                    {(['separate', 'signed'] as const).map((v) => (
                      <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" value={v} checked={amountSign === v} onChange={() => setAmountSign(v)} />
                        {v === 'separate' ? '입금/출금 분리 컬럼' : '±부호 단일 컬럼'}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {accountType === 'securities' && (
                <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded p-2">
                  <strong>금액 컬럼 안내:</strong> 거래 금액이 입금/출금으로 분리된 경우 <em>입금/입고 금액</em>과 <em>출금/출고 금액</em>을 각각 매핑하세요. 단일 부호 컬럼이라면 <em>거래 금액 (±부호)</em>만 매핑하세요.
                </div>
              )}

              {sampleRows.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">샘플 데이터 (최대 5행)</p>
                  <div className="overflow-x-auto rounded border border-gray-200">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50">
                        <tr>{headers.map((h) => <th key={h} className="px-2 py-1 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sampleRows.slice(0, 5).map((row, i) => (
                          <tr key={i}>
                            {headers.map((h) => <td key={h} className="px-2 py-1 text-gray-700 whitespace-nowrap">{row[h]}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={saveProfile} onChange={(e) => setSaveProfile(e.target.checked)} />
                이 매핑을 기관 프로파일로 저장
              </label>
              {saveProfile && selectedInstitution === '직접 입력' && (
                <input type="text" value={customInstitution} onChange={(e) => setCustomInstitution(e.target.value)}
                  placeholder="기관명 입력 (예: 카카오뱅크)" className={inputCls} />
              )}

              {error && <p className="text-red-500 text-sm flex items-center gap-1"><AlertCircle size={14} />{error}</p>}
            </div>
          )}

          {/* ── Step: Preview ── */}
          {step === 'preview' && (
            <div className="px-6 py-5 space-y-4">
              {/* Info bar */}
              <div className="flex items-center gap-3 flex-wrap">
                {currentProfile && (
                  <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-1">
                    프로파일: {currentProfile.institution}
                  </span>
                )}
                {detectedEncoding && (
                  <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded px-2 py-1">
                    <Info size={11} /> 인코딩: {detectedEncoding}
                  </span>
                )}
                {skippedCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    <AlertCircle size={11} /> ⚠️ {skippedCount}건 파싱 실패 (날짜/금액 형식 오류)
                  </span>
                )}
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-800">{total}</p>
                  <p className="text-xs text-gray-500 mt-0.5">전체</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{newCount}</p>
                  <p className="text-xs text-green-600 mt-0.5">신규</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{dupCount}</p>
                  <p className="text-xs text-amber-600 mt-0.5">중복 (건너뜀)</p>
                </div>
              </div>

              {/* Preview table */}
              {newCount > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500">신규 거래 내역 (최대 20건)</p>
                    {currentProfile && (
                      <button
                        onClick={() => setShowMappingDetail((v) => !v)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {showMappingDetail ? '매핑 숨기기' : '매핑된 컬럼 보기'}
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto max-h-64 rounded border border-gray-200">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-1.5 text-left text-gray-600">날짜</th>
                          {accountType === 'bank' ? (
                            <>
                              <th className="px-3 py-1.5 text-left text-gray-600">거래처</th>
                              <th className="px-3 py-1.5 text-right text-gray-600">금액</th>
                              <th className="px-3 py-1.5 text-right text-gray-600">잔고</th>
                            </>
                          ) : (
                            <>
                              <th className="px-3 py-1.5 text-left text-gray-600">종목</th>
                              <th className="px-3 py-1.5 text-right text-gray-600">금액</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {previewRows
                          .filter((r) => !r.isDuplicate)
                          .slice(0, 20)
                          .map((r, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-1.5 font-mono text-gray-600">{r.date}</td>
                              {accountType === 'bank' ? (
                                <>
                                  <td className="px-3 py-1.5 text-gray-700">{r.payee ?? ''}</td>
                                  <td className={`px-3 py-1.5 text-right font-medium tabular-nums ${
                                    r.amount >= 0 ? 'text-blue-600' : 'text-red-600'
                                  }`}>
                                    {r.amount >= 0 ? '+' : ''}₩{Math.abs(r.amount).toLocaleString('ko-KR')}
                                  </td>
                                  <td className="px-3 py-1.5 text-right tabular-nums text-gray-500 font-mono">
                                    {r.balance && r.balance !== 0
                                      ? `₩${r.balance.toLocaleString('ko-KR')}`
                                      : <span className="text-gray-300">-</span>
                                    }
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-3 py-1.5 text-gray-700">{r.security ?? ''}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums text-gray-700">
                                    {r.amount.toLocaleString('ko-KR')}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-4 bg-amber-50 rounded-lg text-amber-700 text-sm">
                  <AlertCircle size={16} />
                  신규 거래 내역이 없습니다. 모두 중복입니다.
                </div>
              )}

              {error && <p className="text-red-500 text-sm flex items-center gap-1"><AlertCircle size={14} />{error}</p>}
            </div>
          )}

          {/* ── Step: Done ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 size={52} className="text-green-500 mb-4" />
              <p className="text-lg font-semibold text-gray-800">Import 완료!</p>
              <p className="text-sm text-gray-500 mt-1">{savedCount}건의 거래 내역이 저장되었습니다.</p>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0">
          {step === 'setup' && (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">취소</button>
              <button onClick={handleAnalyze} disabled={!file || loading}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-800 rounded-lg hover:bg-blue-900 disabled:opacity-50">
                {loading ? '분석 중...' : '파일 분석'}
              </button>
            </>
          )}
          {/* Sheet step buttons are inside SheetSelector */}
          {step === 'mapping' && (
            <>
              <button onClick={() => setStep(sheets.length > 1 ? 'sheets' : 'setup')}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">이전</button>
              <button onClick={handleMappingSubmit} disabled={loading}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-800 rounded-lg hover:bg-blue-900 disabled:opacity-50">
                {loading ? '처리 중...' : '다음 →'}
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => setStep('setup')} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">취소</button>
              <button onClick={handleConfirm} disabled={loading || newCount === 0}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-800 rounded-lg hover:bg-blue-900 disabled:opacity-50">
                {loading ? '저장 중...' : `가져오기 (${newCount}건)`}
              </button>
            </>
          )}
          {step === 'done' && (
            <button onClick={onClose}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-800 rounded-lg hover:bg-blue-900">
              닫기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
