import * as cron from 'node-cron';
import { fetchStockPrices, fetchUsdKrwRate } from './naverFinance';
import { fetchStooqStockPrices } from './stooqFinance';
import { updateCache, getActiveHoldingCodes, isMarketOpen, splitDomesticForeign } from './priceCache';
import { getDb } from '../db';

let task: cron.ScheduledTask | null = null;

function saveUsdKrwRate(rate: number): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ('usd_krw_rate', ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .run(String(rate), new Date().toISOString());
  } catch (e) {
    console.error('[Scheduler] USD/KRW 환율 저장 실패:', e);
  }
}

export async function refreshFxRate(): Promise<void> {
  try {
    const rate = await fetchUsdKrwRate();
    if (rate) {
      saveUsdKrwRate(rate);
      console.log(`[Scheduler] USD/KRW 환율 갱신: ${rate}`);
    }
  } catch (e) {
    console.error('[Scheduler] USD/KRW 환율 갱신 실패:', e);
  }
}

async function refreshPrices(): Promise<void> {
  if (!isMarketOpen()) return;

  const codes = getActiveHoldingCodes();
  if (codes.length === 0) return;

  const { domestic, foreign } = splitDomesticForeign(codes);

  try {
    const [domesticPrices, foreignPrices] = await Promise.all([
      domestic.length > 0 ? fetchStockPrices(domestic) : Promise.resolve([]),
      foreign.length > 0 ? fetchStooqStockPrices(foreign) : Promise.resolve([]),
    ]);
    const allPrices = [...domesticPrices, ...foreignPrices];
    if (allPrices.length > 0) {
      updateCache(allPrices);
      console.log(`[Scheduler] 시세 갱신 완료 — 국내 ${domesticPrices.length}개, 해외 ${foreignPrices.length}개`);
    } else {
      console.warn('[Scheduler] 시세 조회 결과 없음');
    }
  } catch (e) {
    console.error('[Scheduler] 시세 갱신 실패:', e);
  }

  // Also refresh USD/KRW exchange rate during market hours
  await refreshFxRate();
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
