import * as cron from 'node-cron';
import { fetchStockPrices } from './naverFinance';
import { updateCache, getActiveHoldingCodes, isMarketOpen } from './priceCache';

let task: cron.ScheduledTask | null = null;

async function refreshPrices(): Promise<void> {
  if (!isMarketOpen()) return;

  const codes = getActiveHoldingCodes();
  if (codes.length === 0) return;

  try {
    const prices = await fetchStockPrices(codes);
    if (prices.length > 0) {
      updateCache(prices);
      console.log(`[Scheduler] ${prices.length}개 종목 시세 갱신 완료`);
    } else {
      console.warn('[Scheduler] 시세 조회 결과 없음 (네이버 API 응답 없음)');
    }
  } catch (e) {
    console.error('[Scheduler] 시세 갱신 실패:', e);
  }
}

// Start the price auto-refresh scheduler.
// Runs every 10 minutes during Korean market hours (평일 09:00–15:30 KST).
// Cron: every 10 min, UTC hours 0-6, weekdays (= KST 09:00–15:59).
// Actual market-close guard handled by isMarketOpen() inside the job.
export function startScheduler(): void {
  if (task) return;
  task = cron.schedule('*/10 0-6 * * 1-5', refreshPrices, { timezone: 'UTC' });
  console.log('[Scheduler] 주가 자동 갱신 스케줄러 시작 (평일 09:00–15:30 KST, 10분 간격)');
}

export function stopScheduler(): void {
  if (task) {
    task.stop();
    task = null;
    console.log('[Scheduler] 스케줄러 중지');
  }
}
