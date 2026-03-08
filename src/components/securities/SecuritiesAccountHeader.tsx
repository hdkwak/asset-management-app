import React from 'react';
import { RefreshCw, Circle } from 'lucide-react';
import type { HoldingsSummary } from '../../types';

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

function fmtTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  summary: HoldingsSummary | null;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}

export function SecuritiesAccountHeader({ summary, loading, refreshing, onRefresh }: Props) {
  const s = summary;

  const cards = [
    {
      label: '총 평가금액',
      value: s ? fmtKRW(s.total_eval_amount) : '-',
      sub: s ? `투자 ${fmtKRW(s.total_buy_amount)}` : null,
      className: 'text-gray-900',
    },
    {
      label: '평가손익',
      value: s ? `${pnlSign(s.total_unrealized_pnl)}${fmtKRW(s.total_unrealized_pnl)}` : '-',
      sub: s ? fmtRate(s.total_unrealized_pnl_rate) : null,
      className: s ? pnlClass(s.total_unrealized_pnl) : 'text-gray-500',
    },
    {
      label: '실현손익',
      value: s ? `${pnlSign(s.total_realized_pnl)}${fmtKRW(s.total_realized_pnl)}` : '-',
      sub: null,
      className: s ? pnlClass(s.total_realized_pnl) : 'text-gray-500',
    },
    {
      label: '총 손익',
      value: s ? `${pnlSign(s.total_pnl)}${fmtKRW(s.total_pnl)}` : '-',
      sub: null,
      className: s ? pnlClass(s.total_pnl) : 'text-gray-500',
    },
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
      <div className="flex items-start gap-6">
        {/* KPI cards */}
        <div className="flex gap-4 flex-1 flex-wrap">
          {cards.map((card) => (
            <div key={card.label} className="min-w-[140px]">
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className={`text-lg font-bold tabular-nums ${loading ? 'opacity-40' : ''} ${card.className}`}>
                {card.value}
              </p>
              {card.sub && (
                <p className={`text-xs tabular-nums mt-0.5 ${card.className}`}>{card.sub}</p>
              )}
            </div>
          ))}
        </div>

        {/* Price update status + refresh */}
        <div className="flex-shrink-0 text-right">
          {s?.usd_krw_rate && (
            <p className="text-xs text-blue-500 mb-1">
              USD/KRW: {s.usd_krw_rate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
            </p>
          )}
          <p className="text-xs text-gray-400 mb-1">
            시세 업데이트: {fmtTime(s?.last_price_update ?? null)}
          </p>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? '갱신 중...' : '시세 갱신'}
          </button>
          <p className="text-xs text-gray-400 mt-1 flex items-center justify-end gap-1">
            <Circle size={8} className="fill-green-400 text-green-400" />
            자동 10분 간격
          </p>
        </div>
      </div>
    </div>
  );
}
