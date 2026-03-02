import express from 'express';
import cors from 'cors';
import { getDb } from './db';
import accountsRouter from './routes/accounts';
import transactionsRouter from './routes/transactions';
import importRouter from './routes/import';
import profilesRouter from './routes/profiles';
import summaryRouter from './routes/summary';
import categoriesRouter from './routes/categories';
import analyticsRouter from './routes/analytics';
import backupRouter from './routes/backup';
import settingsRouter from './routes/settings';
import holdingsRouter from './routes/holdings';
import pricesRouter from './routes/prices';
import stocksRouter from './routes/stocks';
import { recalculateHoldings } from './services/holdingsEngine';
import { startScheduler } from './services/priceScheduler';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize DB on startup
getDb();

// 기존 증권 계좌 holdings 초기 계산
try {
  const securitiesAccounts = getDb()
    .prepare("SELECT id FROM accounts WHERE type = 'securities'")
    .all() as { id: number }[];
  for (const { id } of securitiesAccounts) {
    recalculateHoldings(id);
  }
  if (securitiesAccounts.length > 0) {
    console.log(`[DB Init] ${securitiesAccounts.length}개 증권 계좌 holdings 초기화 완료`);
  }
} catch (e) {
  console.error('[DB Init] holdings 초기화 실패:', e);
}

app.use('/api/accounts', accountsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/import', importRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/summary', summaryRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/backup', backupRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/holdings', holdingsRouter);
app.use('/api/prices', pricesRouter);
app.use('/api/stocks', stocksRouter);

// Start price auto-refresh scheduler
startScheduler();

app.listen(PORT, () => {
  console.log(`🚀 API 서버가 포트 ${PORT}에서 실행 중입니다`);
});
