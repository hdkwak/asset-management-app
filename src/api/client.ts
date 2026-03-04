import type {
  Account,
  Category,
  CreateAccountPayload,
  UpdateAccountPayload,
  AnyTransaction,
  CreateTransactionPayload,
  InstitutionProfile,
  ParsedRow,
  ImportPreviewResponse,
  ImportConfirmResponse,
  ImportHistory,
  PaginatedResponse,
  FilterState,
  SummaryData,
  BankAnalyticsResponse,
  SecuritiesAnalyticsResponse,
  BackupData,
  RestoreStats,
  AppSettings,
  HoldingsResponse,
  PriceCache,
  PriceStatus,
  StockSearchResult,
} from '../types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ── Accounts ──────────────────────────────────────────────────────────────────

export const getAccounts = () => request<Account[]>('/accounts');

export const createAccount = (data: CreateAccountPayload) =>
  request<Account>('/accounts', { method: 'POST', body: JSON.stringify(data) });

export const updateAccount = (id: number, data: UpdateAccountPayload) =>
  request<Account>(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteAccount = (id: number) =>
  request<void>(`/accounts/${id}`, { method: 'DELETE' });

export const getCategories = () => request<Category[]>('/categories');

export const createCategory = (data: Partial<Category>) =>
  request<Category>('/categories', { method: 'POST', body: JSON.stringify(data) });

export const updateCategory = (id: number, data: Partial<Category>) =>
  request<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteCategory = (id: number) =>
  request<void>(`/categories/${id}`, { method: 'DELETE' });

// ── Transactions ──────────────────────────────────────────────────────────────

export interface TransactionQuery {
  accountId?: number | null;
  group?: 'bank' | 'securities' | null;
  filters?: Partial<FilterState>;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function getTransactions(query: TransactionQuery): Promise<PaginatedResponse<AnyTransaction>> {
  const p = new URLSearchParams();
  if (query.accountId) p.set('account_id', String(query.accountId));
  if (query.group)     p.set('group', query.group);
  const f = query.filters ?? {};
  if (f.search)                       p.set('search',       f.search);
  if (f.dateFrom)                     p.set('date_from',    f.dateFrom);
  if (f.dateTo)                       p.set('date_to',      f.dateTo);
  if (f.amountMin)                    p.set('amount_min',   f.amountMin);
  if (f.amountMax)                    p.set('amount_max',   f.amountMax);
  if (f.categoryId != null)           p.set('category_id',  String(f.categoryId));
  if (f.incomeType)                   p.set('income_type',  f.incomeType);
  if (f.secType)                      p.set('sec_type',     f.secType);
  if (f.securityCode)                 p.set('security_code', f.securityCode);
  if (query.page)                     p.set('page',         String(query.page));
  if (query.limit)                    p.set('limit',        String(query.limit));
  if (query.sortBy)                   p.set('sort_by',      query.sortBy);
  if (query.sortOrder)                p.set('sort_order',   query.sortOrder);
  return request<PaginatedResponse<AnyTransaction>>(`/transactions?${p}`);
}

export const createTransaction = (data: CreateTransactionPayload) =>
  request<AnyTransaction>('/transactions', { method: 'POST', body: JSON.stringify(data) });

export const updateTransaction = (id: number, data: CreateTransactionPayload) =>
  request<AnyTransaction>(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteTransaction = (id: number, accountType: string, accountId: number) =>
  request<void>(`/transactions/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ account_type: accountType, account_id: accountId }),
  });

export const bulkDeleteTransactions = (
  ids: number[],
  accountType: string,
  accountId?: number,
) =>
  request<{ deleted: number }>('/transactions/bulk', {
    method: 'DELETE',
    body: JSON.stringify({ ids, account_type: accountType, account_id: accountId }),
  });

export const bulkUpdateCategory = (ids: number[], categoryId: number | null) =>
  request<{ updated: number }>('/transactions/bulk-category', {
    method: 'PUT',
    body: JSON.stringify({ ids, category_id: categoryId }),
  });

// ── Summary ───────────────────────────────────────────────────────────────────

export const getSummary = () => request<SummaryData>('/summary');

// ── Analytics ─────────────────────────────────────────────────────────────────

export const getBankAnalytics = (params: {
  accountId?: number | 'all';
  year?: number;
  month?: number;
}) => {
  const p = new URLSearchParams();
  if (params.accountId) p.set('account_id', String(params.accountId));
  if (params.year)      p.set('year',       String(params.year));
  if (params.month)     p.set('month',      String(params.month));
  return request<BankAnalyticsResponse>(`/analytics/bank?${p}`);
};

export const getSecuritiesAnalytics = (params: { account_id?: number | 'all' }) => {
  const p = new URLSearchParams();
  if (params.account_id) p.set('account_id', String(params.account_id));
  return request<SecuritiesAnalyticsResponse>(`/analytics/securities?${p}`);
};

// ── Import ────────────────────────────────────────────────────────────────────

export interface SheetInfo {
  name: string;
  rowCount: number;
}

export async function getSheetsFromFile(formData: FormData): Promise<{ sheets: SheetInfo[] }> {
  const res = await fetch(`${BASE}/import/sheets`, { method: 'POST', body: formData });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function previewImport(formData: FormData): Promise<ImportPreviewResponse> {
  const res = await fetch(`${BASE}/import/preview`, { method: 'POST', body: formData });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export const confirmImport = (data: {
  account_id: number;
  account_type: string;
  rows: ParsedRow[];
  filename?: string;
  institution?: string;
  total_rows?: number;
  duplicate_rows?: number;
  skipped_rows?: number;
}) =>
  request<ImportConfirmResponse>('/import/confirm', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getImportHistory = (accountId?: number) =>
  request<ImportHistory[]>(
    accountId != null ? `/import/history?account_id=${accountId}` : '/import/history'
  );

export const deleteImportHistory = (id: number) =>
  request<void>(`/import/history/${id}`, { method: 'DELETE' });

// ── Profiles ──────────────────────────────────────────────────────────────────

export const getProfiles = (accountType?: string) =>
  request<InstitutionProfile[]>(
    accountType ? `/profiles?account_type=${accountType}` : '/profiles'
  );

export const getProfile = (id: number) =>
  request<InstitutionProfile>(`/profiles/${id}`);

export const createProfile = (data: Partial<InstitutionProfile>) =>
  request<InstitutionProfile>('/profiles', { method: 'POST', body: JSON.stringify(data) });

export const updateProfile = (id: number, data: Partial<InstitutionProfile>) =>
  request<InstitutionProfile>(`/profiles/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteProfile = (id: number) =>
  request<void>(`/profiles/${id}`, { method: 'DELETE' });

// ── Backup / Restore ──────────────────────────────────────────────────────────

export const exportBackup = () => request<BackupData>('/backup/export', { method: 'POST' });

export const importBackup = (data: BackupData) =>
  request<{ success: boolean; stats: RestoreStats }>('/backup/import', {
    method: 'POST',
    body: JSON.stringify(data),
  });

// ── App Settings ──────────────────────────────────────────────────────────────

export const getAppSettings = () => request<AppSettings>('/settings');

export const updateAppSetting = (key: string, value: string) =>
  request<{ key: string; value: string }>(`/settings/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });

// ── Holdings (Phase 3) ────────────────────────────────────────────────────────

export const getHoldings = (
  accountId: number | 'all',
  opts?: { includeZero?: boolean; search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }
) => {
  const p = new URLSearchParams({ account_id: String(accountId) });
  if (opts?.includeZero) p.set('include_zero', 'true');
  if (opts?.search) p.set('search', opts.search);
  if (opts?.sortBy) p.set('sort_by', opts.sortBy);
  if (opts?.sortOrder) p.set('sort_order', opts.sortOrder);
  return request<HoldingsResponse>(`/holdings?${p}`);
};

export const recalculateHoldings = (accountId: number) =>
  request<{ success: boolean; account_id: number }>(`/holdings/recalculate?account_id=${accountId}`, {
    method: 'POST',
  });

export const setHoldingTicker = (accountId: number, securityCode: string, tickerCode: string) =>
  request<{ success: boolean }>(
    `/holdings/${accountId}/${encodeURIComponent(securityCode)}/ticker`,
    { method: 'PUT', body: JSON.stringify({ ticker_code: tickerCode }) }
  );

// ── Prices ────────────────────────────────────────────────────────────────────

export const getPrices = (codes: string[]) =>
  request<PriceCache[]>(codes.length > 0 ? `/prices?codes=${codes.join(',')}` : '/prices');

export const refreshAllPrices = () =>
  request<{ refreshed: number; total: number }>('/prices/refresh', { method: 'POST' });

export const refreshStockPrice = (code: string) =>
  request<{ refreshed: number }>(`/prices/refresh/${encodeURIComponent(code)}`, { method: 'POST' });

export const getPriceStatus = () => request<PriceStatus>('/prices/status');

// ── Stocks ────────────────────────────────────────────────────────────────────

export const searchStocks = (q: string) =>
  request<StockSearchResult[]>(`/stocks/search?q=${encodeURIComponent(q)}`);
