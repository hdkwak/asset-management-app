import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Account, AccountType } from '../../types';
import { useAccounts } from '../../hooks/useAccounts';

const COLOR_PRESETS = [
  '#4F86C6',
  '#48B863',
  '#E57C35',
  '#C94F4F',
  '#9B59B6',
  '#1ABC9C',
];

interface Props {
  type: AccountType;
  account?: Account;
  onClose: () => void;
}

export function AccountForm({ type, account, onClose }: Props) {
  const { createAccount, updateAccount, deleteAccount } = useAccounts();
  const isEditing = !!account;

  const [name, setName] = useState(account?.name ?? '');
  const [institution, setInstitution] = useState(account?.institution ?? '');
  const [accountNumber, setAccountNumber] = useState(
    account?.account_number ?? ''
  );
  const [color, setColor] = useState(account?.color ?? COLOR_PRESETS[0]);
  const [errors, setErrors] = useState<{ name?: string; institution?: string }>(
    {}
  );
  const [submitting, setSubmitting] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const validate = () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = '계좌 별칭을 입력하세요.';
    if (!institution.trim()) errs.institution = '금융 기관명을 입력하세요.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (isEditing && account) {
        await updateAccount(account.id, {
          name: name.trim(),
          institution: institution.trim(),
          account_number: accountNumber.trim() || undefined,
          color,
          balance: account.balance,
        });
      } else {
        await createAccount({
          name: name.trim(),
          institution: institution.trim(),
          type,
          account_number: accountNumber.trim() || undefined,
          color,
        });
      }
      onClose();
    } catch (err) {
      console.error('계좌 저장 실패:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!account) return;
    if (
      window.confirm(
        '이 계좌의 모든 거래 내역도 함께 삭제됩니다. 계속하시겠습니까?'
      )
    ) {
      await deleteAccount(account.id);
      onClose();
    }
  };

  const typeLabel = type === 'bank' ? '은행 계좌' : '증권 계좌';

  return (
    /* Overlay */
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? `${typeLabel} 편집` : `${typeLabel} 추가`}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* 계좌 별칭 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              계좌 별칭 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: KB 주거래 통장"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name}</p>
            )}
          </div>

          {/* 금융 기관명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              금융 기관명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="예: KB국민은행"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.institution ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {errors.institution && (
              <p className="text-red-500 text-xs mt-1">{errors.institution}</p>
            )}
          </div>

          {/* 계좌 번호 (선택) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              계좌 번호{' '}
              <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="예: 123-456-789012"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 색상 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              색상 태그
            </label>
            <div className="flex gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                    color === c
                      ? 'ring-2 ring-offset-2 ring-blue-500 scale-110'
                      : ''
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-2">
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                삭제
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-800 rounded-lg hover:bg-blue-900 disabled:opacity-60 transition-colors"
            >
              {submitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
