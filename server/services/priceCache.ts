import { getDb } from '../db';
import type { StockPrice } from './naverFinance';

interface CachedPrice {
  security_code: string;
  security_name: string;
  current_price: number;
  prev_close: number;
  change_amount: number;
  change_rate: number;
  market: string;
  fetched_at: string;
  is_stale: number;
}

const UPSERT_SQL = `
  INSERT INTO price_cache
    (security_code, security_name, current_price, prev_close,
     change_amount, change_rate, market, fetched_at, is_stale)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  ON CONFLICT(security_code) DO UPDATE SET
    security_name  = excluded.security_name,
    current_price  = excluded.current_price,
    prev_close     = excluded.prev_close,
    change_amount  = excluded.change_amount,
    change_rate    = excluded.change_rate,
    market         = excluded.market,
    fetched_at     = excluded.fetched_at,
    is_stale       = 0
`;

export function updateCache(prices: StockPrice[]): void {
  if (prices.length === 0) return;
  const db = getDb();
  const stmt = db.prepare(UPSERT_SQL);
  db.exec('BEGIN');
  try {
    for (const p of prices) {
      stmt.run(
        p.security_code, p.security_name,
        p.current_price, p.prev_close,
        p.change_amount, p.change_rate,
        p.market, p.fetched_at
      );
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function getCache(codes: string[]): CachedPrice[] {
  if (codes.length === 0) return [];
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM price_cache WHERE security_code = ?');
  return codes
    .map((code) => stmt.get(code) as CachedPrice | null)
    .filter((r): r is CachedPrice => r !== null);
}

export function getAllCached(): CachedPrice[] {
  return getDb().prepare('SELECT * FROM price_cache ORDER BY security_code').all() as CachedPrice[];
}

export function markAllStale(): void {
  getDb().prepare('UPDATE price_cache SET is_stale = 1').run();
}

/**
 * Returns true during Korean stock market hours: weekdays 09:00–15:30 KST.
 * KST = UTC + 9.
 */
export function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  if (day === 0 || day === 6) return false;

  const kstHours = (now.getUTCHours() + 9) % 24;
  const kstMins = now.getUTCMinutes();
  const kstTime = kstHours * 100 + kstMins;
  return kstTime >= 900 && kstTime < 1530;
}

/** Returns ticker codes (or security_code fallback) of all holdings with quantity > 0. */
export function getActiveHoldingCodes(): string[] {
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT COALESCE(NULLIF(ticker_code,''), security_code) AS code
       FROM holdings
       WHERE quantity > 0 AND security_code IS NOT NULL AND security_code != ''`
    )
    .all() as { code: string }[];
  return rows.map((r) => r.code);
}

/** 알파벳으로 시작하는 티커는 해외주식(Yahoo Finance), 그 외는 국내주식(Naver) */
export function splitDomesticForeign(codes: string[]): { domestic: string[]; foreign: string[] } {
  const domestic: string[] = [];
  const foreign: string[] = [];
  for (const c of codes) {
    if (/^[A-Za-z]/.test(c.trim())) foreign.push(c);
    else domestic.push(c);
  }
  return { domestic, foreign };
}

export function getCacheStatus(): {
  total_cached: number;
  stale_count: number;
  last_refresh: string | null;
} {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as cnt FROM price_cache').get() as { cnt: number }).cnt;
  const stale = (
    db.prepare('SELECT COUNT(*) as cnt FROM price_cache WHERE is_stale = 1').get() as {
      cnt: number;
    }
  ).cnt;
  const row = db
    .prepare('SELECT MAX(fetched_at) as ts FROM price_cache WHERE is_stale = 0')
    .get() as { ts: string | null };
  return { total_cached: total, stale_count: stale, last_refresh: row.ts };
}
