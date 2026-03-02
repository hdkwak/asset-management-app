import { Router, Request, Response } from 'express';
import { searchStock } from '../services/naverFinance';

const router = Router();

// ── GET /api/stocks/search?q=삼성전자 ────────────────────────────────────────
router.get('/search', async (req: Request, res: Response) => {
  const q = ((req.query.q as string) ?? '').trim();
  if (q.length < 1) {
    res.json([]);
    return;
  }
  try {
    const results = await searchStock(q);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
