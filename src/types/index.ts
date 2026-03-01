export type AccountType = 'bank' | 'securities';

export interface Account {
  id: number;
  name: string;
  institution: string;
  type: AccountType;
  account_number: string | null;
  color: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  is_income: number;
  icon: string;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface MonthlyData {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface ByCategoryData {
  category_id: number;
  category_name: string;
  color: string;
  icon: string;
  amount: number;
  count: number;
  ratio: number;
}

export interface CategoryMonthlyData {
  month: string;
  category_name: string;
  color: string;
  amount: number;
}

export interface BankAnalyticsResponse {
  summary: {
    thisMonth: { income: number; expense: number; net: number };
    lastMonth: { income: number; expense: number; net: number };
    incomeChange: number;
    expenseChange: number;
  };
  monthly: MonthlyData[];
  byCategory: ByCategoryData[];
  dailyBalance: { date: string; balance: number }[];
  categoryMonthly: CategoryMonthlyData[];
}

export interface CreateAccountPayload {
  name: string;
  institution: string;
  type: AccountType;
  account_number?: string;
  color: string;
}

export interface UpdateAccountPayload {
  name: string;
  institution: string;
  account_number?: string;
  color: string;
  balance?: number;
}

// ── Transactions ─────────────────────────────────────────────────────────────

export interface BankTransaction {
  id: number;
  account_id: number;
  date: string;
  payee: string;
  category_id: number | null;
  amount: number;
  balance: number;
  note: string;
  import_hash: string | null;
  created_at: string;
  updated_at: string;
  // Group view extras
  account_name?: string;
  account_color?: string;
}

export interface SecuritiesTransaction {
  id: number;
  account_id: number;
  date: string;
  type: string;
  security: string;
  security_code: string;
  description: string;
  amount: number;
  balance: number;
  import_hash: string | null;
  created_at: string;
  updated_at: string;
  // Group view extras
  account_name?: string;
  account_color?: string;
}

export type AnyTransaction = BankTransaction | SecuritiesTransaction;

export interface CreateBankTransactionPayload {
  account_id: number;
  account_type: 'bank';
  date: string;
  payee: string;
  category_id?: number | null;
  amount: number;
  balance?: number;
  note?: string;
}

export interface CreateSecuritiesTransactionPayload {
  account_id: number;
  account_type: 'securities';
  date: string;
  type: string;
  security?: string;
  security_code?: string;
  description?: string;
  amount: number;
  balance?: number;
}

export type CreateTransactionPayload =
  | CreateBankTransactionPayload
  | CreateSecuritiesTransactionPayload;

// ── Pagination & Filters ─────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface FilterState {
  search: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
  // bank
  categoryId: number | null;
  incomeType: '' | 'income' | 'expense';
  // securities
  secType: string;
}

export const defaultFilters: FilterState = {
  search: '',
  dateFrom: '',
  dateTo: '',
  amountMin: '',
  amountMax: '',
  categoryId: null,
  incomeType: '',
  secType: '',
};

// ── Summary / Dashboard ───────────────────────────────────────────────────────

export interface RecentTransaction {
  id: number;
  date: string;
  amount: number;
  description: string;
  account_name: string;
  account_color: string;
  account_type: AccountType;
  created_at: string;
}

export interface SummaryData {
  totalBankBalance: number;
  totalSecuritiesBalance: number;
  totalAssets: number;
  bankAccountCount: number;
  securitiesAccountCount: number;
  thisMonthIncome: number;
  thisMonthExpense: number;
  thisMonthNet: number;
  recentTransactions: RecentTransaction[];
}

// ── Backup ────────────────────────────────────────────────────────────────────

export interface BackupData {
  version: 1;
  exportedAt: string;
  accounts: Account[];
  categories: Category[];
  bank_transactions: BankTransaction[];
  securities_transactions: SecuritiesTransaction[];
  institution_profiles: InstitutionProfile[];
}

export interface RestoreStats {
  accounts: number;
  categories: number;
  bankTx: number;
  securitiesTx: number;
  profiles: number;
}

// ── App Settings ──────────────────────────────────────────────────────────────

export type AppSettings = Record<string, string>;

// ── Institution Profiles ──────────────────────────────────────────────────────

export interface InstitutionProfile {
  id: number;
  institution: string;
  account_type: AccountType;
  encoding: string;
  column_map: string; // JSON string
  date_format: string;
  amount_sign: string;
  skip_rows: number;
  is_preset: number;
  file_type: string;    // 'csv' | 'xls' | 'xlsx' | 'pdf' | 'any'
  sheet_index: number;
  header_row: number;   // -1 = auto
  notes: string;
}

// ── Import History ────────────────────────────────────────────────────────────

export interface ImportHistory {
  id: number;
  account_id: number;
  filename: string;
  institution: string;
  file_type: string;
  total_rows: number;
  imported_rows: number;
  duplicate_rows: number;
  skipped_rows: number;
  status: 'success' | 'partial' | 'failed';
  error_message: string | null;
  imported_at: string;
}

// ── Import ───────────────────────────────────────────────────────────────────

export interface ParsedRow {
  date: string;
  amount: number;
  import_hash: string;
  isDuplicate: boolean;
  // bank-specific
  payee?: string;
  note?: string;
  // securities-specific
  type?: string;
  security?: string;
  security_code?: string;
  description?: string;
  balance?: number;
}

export interface ImportPreviewResponse {
  needsMapping: boolean;
  headers: string[];
  sampleRows: Record<string, string>[];
  rows?: ParsedRow[];
  total?: number;
  newCount?: number;
  duplicateCount?: number;
  skippedCount?: number;
  detectedEncoding?: string;
  profileMatch: { institution: string; profileId: number } | null;
}

export interface ImportConfirmResponse {
  saved: number;
  duplicates: number;
}
