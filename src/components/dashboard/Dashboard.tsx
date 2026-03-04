import React, { useEffect, useState } from 'react';
import { Landmark, TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, TrendingDown } from 'lucide-react';
import type { SummaryData } from '../../types';
import { getSummary } from '../../api/client';
import { AssetCompositionChart } from './AssetCompositionChart';
import { SecuritiesMiniWidget } from './SecuritiesMiniWidget';

function fmt(n: number) {
  return `₩${Math.abs(n).toLocaleString('ko-KR')}`;
}

interface SummaryCardProps {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: string;
}

function SummaryCard({ label, value, sub, icon, color }: SummaryCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: color + '20' }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

export function Dashboard() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSummary()
      .then(setSummary)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        불러오는 중...
      </div>
    );
  }

  if (!summary) return null;

  const recent = summary.recentTransactions;
  const securitiesEval = summary.totalSecuritiesEval ?? summary.totalSecuritiesBalance;

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">자산 요약</h2>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          label="총 자산"
          value={fmt(summary.totalAssets)}
          sub={`은행 ${summary.bankAccountCount}개 · 증권 ${summary.securitiesAccountCount}개`}
          icon={<Wallet size={18} />}
          color="#1E40AF"
        />
        <SummaryCard
          label="은행 잔고 합계"
          value={fmt(summary.totalBankBalance)}
          sub={`${summary.bankAccountCount}개 계좌`}
          icon={<Landmark size={18} />}
          color="#0369A1"
        />
        <SummaryCard
          label="증권 평가금액 합계"
          value={fmt(securitiesEval)}
          sub={`${summary.securitiesAccountCount}개 계좌`}
          icon={<TrendingUp size={18} />}
          color="#7C3AED"
        />
        <SummaryCard
          label="이번 달 순수익"
          value={(summary.thisMonthNet ?? 0) >= 0 ? `+${fmt(summary.thisMonthNet ?? 0)}` : `-${fmt(summary.thisMonthNet ?? 0)}`}
          sub={`수입 ${fmt(summary.thisMonthIncome ?? 0)} · 지출 ${fmt(summary.thisMonthExpense ?? 0)}`}
          icon={(summary.thisMonthNet ?? 0) >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          color={(summary.thisMonthNet ?? 0) >= 0 ? '#059669' : '#DC2626'}
        />
      </div>

      {/* Asset composition + top holdings */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <AssetCompositionChart
          bankBalance={summary.totalBankBalance}
          securitiesEval={securitiesEval}
        />
        <div className="col-span-2">
          <SecuritiesMiniWidget holdings={summary.topHoldings ?? []} />
        </div>
      </div>

      {/* Recent transactions */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">최근 거래 내역</h3>
        </div>

        {recent.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">거래 내역이 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">날짜</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">계좌</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">내용</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">금액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recent.map((tx) => (
                <tr key={`${tx.account_type}-${tx.id}`} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">{tx.date}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tx.account_color }}
                      />
                      <span className="text-gray-700 text-xs truncate max-w-[120px]">{tx.account_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600 text-xs truncate max-w-[200px]">
                    {tx.description || '-'}
                  </td>
                  <td className={`px-5 py-3 text-right font-medium tabular-nums text-sm ${
                    tx.amount >= 0 ? 'text-blue-600' : 'text-red-500'
                  }`}>
                    <span className="inline-flex items-center gap-0.5">
                      {tx.amount >= 0
                        ? <ArrowUpRight size={12} />
                        : <ArrowDownRight size={12} />
                      }
                      {fmt(tx.amount)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
