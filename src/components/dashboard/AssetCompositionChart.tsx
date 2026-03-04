import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  bankBalance: number;
  securitiesEval: number;
}

function fmt(n: number) {
  if (n >= 1_0000_0000) return `₩${(n / 1_0000_0000).toFixed(1)}억`;
  if (n >= 1_0000) return `₩${(n / 1_0000).toFixed(0)}만`;
  return `₩${n.toLocaleString('ko-KR')}`;
}

const COLORS = ['#0369A1', '#7C3AED'];
const LABELS = ['은행잔고', '증권평가'];

export function AssetCompositionChart({ bankBalance, securitiesEval }: Props) {
  const total = bankBalance + securitiesEval;
  const data = [
    { name: '은행잔고', value: bankBalance },
    { name: '증권평가', value: securitiesEval },
  ];

  const hasData = total > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">자산 구성</h3>
      <div className="flex-1 flex items-center justify-center">
        {hasData ? (
          <div className="relative" style={{ width: 200, height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number | undefined, name: string | undefined) => {
                    const v = value ?? 0;
                    const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                    return [`${v.toLocaleString('ko-KR')}원 (${pct}%)`, name ?? ''];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-gray-400">총 자산</span>
              <span className="text-sm font-bold text-gray-800">{fmt(total)}</span>
            </div>
          </div>
        ) : (
          <div className="text-gray-400 text-sm py-8">자산 데이터 없음</div>
        )}
      </div>
      {hasData && (
        <div className="flex justify-center gap-5 mt-2">
          {LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[i] }} />
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
