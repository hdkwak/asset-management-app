import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { StockSearchInput } from './StockSearchInput';
import type {
  AnyTransaction,
  BankTransaction,
  SecuritiesTransaction,
  AccountType,
  Category,
  CreateTransactionPayload,
} from '../../types';

const SECURITIES_TYPES = ['매수', '매도', '배당', '입금', '출금', '기타'];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  accountId: number;
  accountType: AccountType;
  categories: Category[];
  transaction?: AnyTransaction;
  onSave: (data: CreateTransactionPayload) => Promise<void>;
  onClose: () => void;
}

export function TransactionForm({
  accountId,
  accountType,
  categories,
  transaction,
  onSave,
  onClose,
}: Props) {
  const isEditing = !!transaction;
  const isBank = accountType === 'bank';

  // Bank fields
  const bt = transaction as BankTransaction | undefined;
  const [date, setDate] = useState(bt?.date ?? today());
  const [payee, setPayee] = useState(bt?.payee ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(bt?.category_id ?? null);
  const [amountAbs, setAmountAbs] = useState(bt ? Math.abs(bt.amount).toString() : '');
  const [isIncome, setIsIncome] = useState(bt ? bt.amount >= 0 : false);
  const [bankBalance, setBankBalance] = useState(bt?.balance ? bt.balance.toString() : '');
  const [note, setNote] = useState(bt?.note ?? '');

  // Securities fields
  const st = transaction as SecuritiesTransaction | undefined;
  const [secType, setSecType] = useState(st?.type ?? '매수');
  const [security, setSecurity] = useState(st?.security ?? '');
  const [securityCode, setSecurityCode] = useState(st?.security_code ?? '');
  const [description, setDescription] = useState(st?.description ?? '');
  const [amount, setAmount] = useState(st?.amount?.toString() ?? '');
  const [balance, setBalance] = useState(st?.balance?.toString() ?? '');
  const [quantity, setQuantity] = useState(st?.quantity ? st.quantity.toString() : '');
  const [unitPrice, setUnitPrice] = useState(st?.unit_price ? st.unit_price.toString() : '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) { setError('날짜를 입력하세요.'); return; }

    setSubmitting(true);
    setError('');
    try {
      let payload: CreateTransactionPayload;
      if (isBank) {
        const rawAmt = parseFloat(amountAbs.replace(/,/g, '')) || 0;
        payload = {
          account_id: accountId,
          account_type: 'bank',
          date,
          payee,
          category_id: categoryId,
          amount: isIncome ? rawAmt : -rawAmt,
          balance: parseFloat(bankBalance.replace(/,/g, '')) || 0,
          note,
        };
      } else {
        payload = {
          account_id: accountId,
          account_type: 'securities',
          date,
          type: secType,
          security,
          security_code: securityCode,
          description,
          amount: parseFloat(amount.replace(/,/g, '')) || 0,
          balance: parseFloat(balance.replace(/,/g, '')) || 0,
          quantity: parseFloat(quantity.replace(/,/g, '')) || 0,
          unit_price: parseFloat(unitPrice.replace(/,/g, '')) || 0,
        };
      }
      await onSave(payload);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const label = 'block text-sm font-medium text-gray-700 mb-1';
  const input =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? '거래 내역 편집' : '거래 내역 추가'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Date */}
          <div>
            <label className={label}>날짜 <span className="text-red-500">*</span></label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} required />
          </div>

          {isBank ? (
            <>
              {/* Payee */}
              <div>
                <label className={label}>거래처</label>
                <input type="text" value={payee} onChange={(e) => setPayee(e.target.value)}
                  placeholder="예: 스타벅스" className={input} />
              </div>

              {/* Category */}
              <div>
                <label className={label}>카테고리</label>
                <select value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                  className={input}>
                  <option value="">미분류</option>
                  <optgroup label="수입">
                    {categories.filter((c) => c.is_income).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="지출">
                    {categories.filter((c) => !c.is_income).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Amount with toggle */}
              <div>
                <label className={label}>금액 <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm flex-shrink-0">
                    <button type="button"
                      className={`px-3 py-2 font-medium transition-colors ${isIncome ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                      onClick={() => setIsIncome(true)}>수입</button>
                    <button type="button"
                      className={`px-3 py-2 font-medium transition-colors ${!isIncome ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                      onClick={() => setIsIncome(false)}>지출</button>
                  </div>
                  <input type="text" value={amountAbs}
                    onChange={(e) => setAmountAbs(e.target.value)}
                    placeholder="0" className={`${input} flex-1`} />
                </div>
              </div>

              {/* Balance after transaction */}
              <div>
                <label className={label}>거래 후 잔고</label>
                <input
                  type="text"
                  value={bankBalance}
                  onChange={(e) => setBankBalance(e.target.value)}
                  placeholder="0"
                  className={input}
                />
                <p className="text-xs text-gray-400 mt-1">입력하지 않으면 0으로 저장됩니다</p>
              </div>

              {/* Note */}
              <div>
                <label className={label}>메모</label>
                <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="메모를 입력하세요" className={input} />
              </div>
            </>
          ) : (
            <>
              {/* Securities type */}
              <div>
                <label className={label}>거래 유형 <span className="text-red-500">*</span></label>
                <select value={secType} onChange={(e) => setSecType(e.target.value)} className={input}>
                  {SECURITIES_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Security name + code */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>종목명</label>
                  <StockSearchInput
                    value={security}
                    onChange={(name, code) => {
                      setSecurity(name);
                      if (code) setSecurityCode(code);
                    }}
                  />
                </div>
                <div>
                  <label className={label}>종목코드</label>
                  <input type="text" value={securityCode} onChange={(e) => setSecurityCode(e.target.value)}
                    placeholder="005930" className={input} />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={label}>거래 내용</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="시장가 매수 100주" className={input} />
              </div>

              {/* Quantity + unit_price (매수/매도 전용) */}
              {(secType === '매수' || secType === '매도') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>수량</label>
                    <input type="text" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                      placeholder="0" className={input} />
                  </div>
                  <div>
                    <label className={label}>단가 (1주당)</label>
                    <input type="text" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)}
                      placeholder="0" className={input} />
                  </div>
                </div>
              )}

              {/* Amount + balance */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>거래 금액 <span className="text-red-500">*</span></label>
                  <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)}
                    placeholder="0" className={input} />
                </div>
                <div>
                  <label className={label}>잔고</label>
                  <input type="text" value={balance} onChange={(e) => setBalance(e.target.value)}
                    placeholder="0" className={input} />
                </div>
              </div>
            </>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              취소
            </button>
            <button type="submit" disabled={submitting}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-800 rounded-lg hover:bg-blue-900 disabled:opacity-60">
              {submitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
