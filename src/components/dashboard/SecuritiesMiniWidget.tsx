import type { TopHolding } from '../../types';

interface Props {
  holdings: TopHolding[];
}

function fmtAmount(n: number) {
  return `₩${Math.abs(n).toLocaleString('ko-KR')}`;
}

export function SecuritiesMiniWidget({ holdings }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full flex flex-col">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">상위 보유 종목</h3>
      {holdings.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          보유 종목 없음
        </div>
      ) : (
        <div className="flex-1 flex flex-col divide-y divide-gray-50">
          {holdings.map((h) => {
            const isPositive = h.unrealized_pnl_rate >= 0;
            const rateColor = isPositive ? 'text-red-600' : 'text-blue-600';
            const rateSign = isPositive ? '+' : '';
            const truncated = h.security_name.length > 16
              ? h.security_name.slice(0, 16) + '…'
              : h.security_name;
            return (
              <div key={h.security_name} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-gray-700 truncate flex-1 mr-3">{truncated}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs font-medium tabular-nums ${rateColor}`}>
                    {rateSign}{h.unrealized_pnl_rate.toFixed(2)}%
                  </span>
                  <span className="text-sm font-medium text-gray-800 tabular-nums">
                    {fmtAmount(h.eval_amount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
