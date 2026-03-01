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

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize DB on startup
getDb();

app.use('/api/accounts', accountsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/import', importRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/summary', summaryRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/backup', backupRouter);
app.use('/api/settings', settingsRouter);

app.listen(PORT, () => {
  console.log(`🚀 API 서버가 포트 ${PORT}에서 실행 중입니다`);
});
