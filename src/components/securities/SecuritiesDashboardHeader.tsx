import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { Account, SecuritiesAnalyticsSummary } from '../../types';

function fmtKRW(n: number) {
  return `₩${Math.abs(n).toLocaleString('ko-KR')}`;
}

function pnlClass(n: number) {
  if (n > 0) return 'text-red-600';
  if (n < 0) return 'text-blue-600';
  return 'text-gray-500';
}

function pnlSign(n: number) {
  if (n > 0) return '+';
  if (n < 0) return '-';
  return '';
}

function fmtRate(r: number) {
  return `${r >= 0 ? '+' : ''}${r.toFixed(2)}%`;
}

interface Props {
  summary: SecuritiesAnalyticsSummary | null;
  accounts: Account[];
  selectedAccountId: number | 'all';
  onAccountChange: (id: number | 'all') => void;
  refreshing: boolean;
  onRefresh: () => void;
}

export function SecuritiesDashboardHeader({
  summary,
  accounts,
  selectedAccountId,
  onAccountChange,
  refreshing,
  onRefresh,
}: Props) {
  const s = summary;
  const pnlRate =
    s && s.total_buy_amount > 0
      ? Math.round((s.total_unrealized_pnl / s.total_buy_amount) * 10000) / 100
      : 0;

  const cards = [
    {
      label: '총 매수원금',
      value: s ? fmtKRW(s.total_buy_amount) : '-',
      sub: s ? `보유 ${s.holding_count}종목` : null,
      className: 'text-gray-900',
    },
    {
      label: '총 평가금액',
      value: s ? fmtKRW(s.total_eval_amount) : '-',
      sub: null,
      className: 'text-gray-900',
    },
    {
      label: '미실현 손익',
      value: s ? `${pnlSign(s.total_unrealized_pnl)}${fmtKRW(s.total_unrealized_pnl)}` : '-',
      sub: s ? fmtRate(pnlRate) : null,
      className: s ? pnlClass(s.total_unrealized_pnl) : 'text-gray-500',
    },
    {
      label: '실현 손익',
      value: s ? `${pnlSign(s.total_realized_pnl)}${fmtKRW(s.total_realized_pnl)}` : '-',
      sub: s && s.total_dividend > 0 ? `배당 ${fmtKRW(s.total_dividend)}` : null,
      className: s ? pnlClass(s.total_realized_pnl) : 'text-gray-500',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-6 py-4">
      <div className="flex items-start gap-6">
        {/* Account selector */}
        <div className="flex-shrink-0">
          <p className="text-xs text-gray-500 mb-1.5">계좌 선택</p>
          <select
            value={selectedAccountId}
            onChange={(e) =>
              onAccountChange(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">전체 증권</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* KPI cards */}
        <div className="flex gap-6 flex-1 flex-wrap">
          {cards.map((card) => (
            <div key={card.label} className="min-w-[130px]">
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className={`text-lg font-bold tabular-nums ${card.className}`}>
                {card.value}
              </p>
              {card.sub && (
                <p className={`text-xs tabular-nums mt-0.5 ${card.className}`}>{card.sub}</p>
              )}
            </div>
          ))}
        </div>

        {/* Refresh button */}
        <div className="flex-shrink-0 self-center">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? '갱신 중...' : '시세 갱신'}
          </button>
        </div>
      </div>
    </div>
  );
}
