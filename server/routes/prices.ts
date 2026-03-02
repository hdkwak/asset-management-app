import { Router, Request, Response } from 'express';
import { fetchStockPrice, fetchStockPrices } from '../services/naverFinance';
import {
  updateCache,
  getCache,
  getAllCached,
  getActiveHoldingCodes,
  isMarketOpen,
  getCacheStatus,
} from '../services/priceCache';

const router = Router();

// ── GET /api/prices?codes=005930,000660 ───────────────────────────────────────
// Returns cached prices; fetches from Naver immediately if a code is missing.
router.get('/', async (req: Request, res: Response) => {
  const codesParam = req.query.codes as string | undefined;
  if (!codesParam) {
    res.json(getAllCached());
    return;
  }

  const codes = codesParam
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  if (codes.length === 0) {
    res.json([]);
    return;
  }

  let cached = getCache(codes);
  const cachedCodes = new Set(cached.map((p) => p.security_code));
  const missing = codes.filter((c) => !cachedCodes.has(c));

  if (missing.length > 0) {
    try {
      const fetched = await fetchStockPrices(missing);
      if (fetched.length > 0) {
        updateCache(fetched);
        cached = [...cached, ...getCache(missing)];
      }
    } catch {
      // Return whatever is cached even on network failure
    }
  }

  res.json(cached);
});

// ── GET /api/prices/status ────────────────────────────────────────────────────
router.get('/status', (req: Request, res: Response) => {
  const { total_cached, stale_count, last_refresh } = getCacheStatus();
  res.json({
    total_cached,
    stale_count,
    last_refresh,
    next_scheduled: null,
    market_open: isMarketOpen(),
  });
});

// ── POST /api/prices/refresh ──────────────────────────────────────────────────
// Immediately refresh all holding codes regardless of market hours.
router.post('/refresh', async (req: Request, res: Response) => {
  const codes = getActiveHoldingCodes();
  if (codes.length === 0) {
    res.json({ refreshed: 0, total: 0, message: '보유 종목 없음' });
    return;
  }
  try {
    const prices = await fetchStockPrices(codes);
    if (prices.length > 0) updateCache(prices);
    res.json({ refreshed: prices.length, total: codes.length });
  } catch (err) {
    res.status(500).json({ error: `시세 갱신 실패: ${(err as Error).message}` });
  }
});

// ── POST /api/prices/refresh/:code ────────────────────────────────────────────
router.post('/refresh/:code', async (req: Request, res: Response) => {
  const { code } = req.params;
  try {
    const price = await fetchStockPrice(code);
    if (price) {
      updateCache([price]);
      res.json({ refreshed: 1, price });
    } else {
      res.status(404).json({ error: `시세를 가져올 수 없음: ${code}` });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
