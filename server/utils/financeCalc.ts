/**
 * 이동 평균 매수가 계산
 * (기존 보유 수량 × 기존 평균 매수가 + 신규 매수 수량 × 매수 단가)
 * ÷ (기존 보유 수량 + 신규 매수 수량)
 */
export function calcMovingAvgPrice(
  prevQty: number,
  prevAvg: number,
  newQty: number,
  newPrice: number
): number {
  const totalQty = prevQty + newQty;
  if (totalQty === 0) return 0;
  return (prevQty * prevAvg + newQty * newPrice) / totalQty;
}

/**
 * 실현 손익 계산
 * (매도 단가 - 평균 매수 단가) × 매도 수량
 */
export function calcRealizedPnl(
  sellQty: number,
  sellPrice: number,
  avgBuyPrice: number
): number {
  return (sellPrice - avgBuyPrice) * sellQty;
}

/**
 * 수익률 계산 (%, 소수점 2자리)
 */
export function calcPnlRate(pnl: number, cost: number): number {
  if (cost === 0) return 0;
  return Math.round((pnl / cost) * 10000) / 100;
}

/**
 * 금액 포맷 (서버 사이드, 로깅용)
 */
export function formatKRW(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}₩${Math.abs(amount).toLocaleString('ko-KR')}`;
}
