import React, { useState } from 'react';
import { X, PlusCircle, Trash2 } from 'lucide-react';
import type { InstitutionProfile } from '../../types';

const FILE_TYPES = ['csv', 'xls', 'xlsx', 'pdf', 'any'];
const ENCODINGS  = ['utf-8', 'euc-kr', 'auto'];
const ACCOUNT_TYPES = [
  { value: 'bank',       label: '은행 계좌' },
  { value: 'securities', label: '증권 계좌' },
];
const AMOUNT_SIGNS = [
  { value: 'separate', label: '입금/출금 분리 컬럼' },
  { value: 'signed',   label: '±부호 단일 컬럼' },
];

// Standard column keys by account type
const BANK_MAP_KEYS = ['date', 'payee', 'amount', 'amount_in', 'amount_out', 'balance', 'note'];
const SEC_MAP_KEYS  = ['date', 'type', 'security', 'security_code', 'quantity', 'unit_price', 'description', 'amount', 'balance'];
const COL_LABELS: Record<string, string> = {
  date: '날짜', payee: '거래처', amount: '금액(±)', amount_in: '입금 금액',
  amount_out: '출금 금액', balance: '잔고', note: '메모',
  type: '거래 유형', security: '종목명', security_code: '종목코드',
  quantity: '수량', unit_price: '단가', description: '거래 내용',
};

interface Props {
  profile?: InstitutionProfile; // undefined = create mode
  copyFrom?: InstitutionProfile; // for "복사" mode
  onSave: (data: Partial<InstitutionProfile>) => Promise<void>;
  onClose: () => void;
}

export function ProfileForm({ profile, copyFrom, onSave, onClose }: Props) {
  const src = profile ?? copyFrom;
  const isEdit = !!profile;

  const parseColMap = (raw: string): Record<string, string> => {
    try { return JSON.parse(raw); } catch { return {}; }
  };

  const [institution, setInstitution] = useState(
    src ? (copyFrom ? `${src.institution} (커스텀)` : src.institution) : ''
  );
  const [accountType, setAccountType] = useState<string>(src?.account_type ?? 'bank');
  const [encoding, setEncoding]       = useState(src?.encoding ?? 'utf-8');
  const [amountSign, setAmountSign]   = useState(src?.amount_sign ?? 'separate');
  const [fileType, setFileType]       = useState(src?.file_type ?? 'csv');
  const [sheetIndex, setSheetIndex]   = useState(src?.sheet_index ?? 0);
  const [headerRow, setHeaderRow]     = useState(src?.header_row ?? -1);
  const [skipRows, setSkipRows]       = useState(src?.skip_rows ?? 0);
  const [notes, setNotes]             = useState(src?.notes ?? '');
  const [colMap, setColMap]           = useState<Record<string, string>>(
    src ? parseColMap(src.column_map) : {}
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const mapKeys = accountType === 'bank' ? BANK_MAP_KEYS : SEC_MAP_KEYS;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution.trim()) { setError('기관명을 입력하세요.'); return; }
    if (!colMap['date']) { setError('날짜 컬럼 이름을 입력하세요.'); return; }
    setSaving(true);
    try {
      await onSave({
        institution: institution.trim(),
        account_type: accountType as InstitutionProfile['account_type'],
        encoding,
        column_map: JSON.stringify(colMap),
        amount_sign: amountSign,
        file_type: fileType,
        sheet_index: sheetIndex,
        header_row: headerRow,
        skip_rows: skipRows,
        notes,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
      setSaving(false);
    }
  };

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-800">
            {isEdit ? '프로파일 편집' : copyFrom ? '프로파일 복사 (새 커스텀 생성)' : '프로파일 추가'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">
            {/* Institution */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">기관명</label>
              <input value={institution} onChange={(e) => setInstitution(e.target.value)}
                placeholder="예: 카카오뱅크" className={inputCls} />
            </div>

            {/* Account type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">계좌 유형</label>
                <select value={accountType} onChange={(e) => setAccountType(e.target.value)} className={inputCls}>
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">파일 형식</label>
                <select value={fileType} onChange={(e) => setFileType(e.target.value)} className={inputCls}>
                  {FILE_TYPES.map((t) => (
                    <option key={t} value={t}>{t.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Encoding + Amount sign */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">인코딩</label>
                <select value={encoding} onChange={(e) => setEncoding(e.target.value)} className={inputCls}>
                  {ENCODINGS.map((e) => (
                    <option key={e} value={e}>{e === 'auto' ? '자동 감지' : e.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">금액 방식</label>
                <select value={amountSign} onChange={(e) => setAmountSign(e.target.value)} className={inputCls}>
                  {AMOUNT_SIGNS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* XLS options */}
            {(fileType === 'xls' || fileType === 'xlsx') && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">기본 시트 인덱스</label>
                  <input type="number" min={0} value={sheetIndex}
                    onChange={(e) => setSheetIndex(Number(e.target.value))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">헤더 행 (-1=자동)</label>
                  <input type="number" min={-1} value={headerRow}
                    onChange={(e) => setHeaderRow(Number(e.target.value))} className={inputCls} />
                </div>
              </div>
            )}

            {/* Skip rows + Notes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">건너뛸 행 수</label>
                <input type="number" min={0} value={skipRows}
                  onChange={(e) => setSkipRows(Number(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">비고</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="메모" className={inputCls} />
              </div>
            </div>

            {/* Column mapping */}
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">
                컬럼 매핑 <span className="text-gray-400 font-normal">(파일의 실제 컬럼 헤더명 입력)</span>
              </p>
              <div className="space-y-1.5">
                {mapKeys.map((key) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-24 flex-shrink-0 text-right">
                      {COL_LABELS[key] ?? key}
                      {(key === 'date' || key === 'amount') && (
                        <span className="text-red-500 ml-0.5">*</span>
                      )}
                    </span>
                    <input
                      value={colMap[key] ?? ''}
                      onChange={(e) => setColMap((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder={`파일 헤더명`}
                      className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>

          <div className="px-5 pb-5 flex justify-end gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              취소
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-800 rounded-lg hover:bg-blue-900 disabled:opacity-50">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
