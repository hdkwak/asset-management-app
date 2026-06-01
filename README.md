# NsBook / 자산관리

A Korean personal asset management web app for individuals managing multiple bank and securities accounts. Single-user, runs entirely on your local machine — no cloud sync, no authentication required.

---

## Features

- **Account Management** — Add/edit/delete bank and securities accounts with custom colors
- **Transaction Tracking** — Full CRUD for bank and securities transactions with search, filter, sort, and pagination
- **File Import** — Import transactions from CSV, Excel (.xlsx/.xls), and PDF files with automatic duplicate detection
- **Institution Profiles** — Pre-configured column mappings for 7 major Korean banks and 6 brokerages; fully customizable
- **Categories** — Create and manage income/expense categories with icons and colors; bulk assign transactions
- **Securities Portfolio** — Holdings engine that calculates current positions from transaction history; live stock prices via Naver Finance
- **Analytics** — Income/expense charts for bank accounts; portfolio composition and history charts for securities accounts
- **Dashboard** — KPI cards (total assets, bank balance, securities value, monthly net income) + recent transactions
- **Export** — Download transactions as CSV or Excel
- **Backup / Restore** — Full JSON backup and restore of all data

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Express.js (local REST API) |
| Database | Node.js built-in `node:sqlite` (SQLite, no compilation needed) |
| Styling | Tailwind CSS v3 |
| Charts | Recharts |
| Tables | TanStack Table v8 |
| File Parsing | papaparse (CSV), SheetJS/xlsx (Excel), pdf-parse (PDF) |
| Icons | lucide-react |

---

## Prerequisites

- **Node.js v22+** (v24 recommended — uses the built-in `node:sqlite` module)
- **npm**

> **Note**: This project uses Node.js's built-in SQLite module (`node:sqlite`) instead of `better-sqlite3`, so no native compilation is required.

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/hdkwak/asset-management-app.git
cd asset-management-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the development server

```bash
npm run dev
```

This starts both servers concurrently:
- **Frontend** (Vite): `http://localhost:5173`
- **Backend** (Express API): `http://localhost:3001`

The SQLite database file (`asset-manager.db`) is created automatically on first run.

Open your browser to `http://localhost:5173`.

---

## Available Scripts

```bash
npm run dev          # Start both client + server (recommended)
npm run dev:client   # Vite frontend only (port 5173)
npm run dev:server   # Express API server only (port 3001)
npm run build        # TypeScript check + production build
npm run preview      # Preview the production build
```

---

## Project Structure

```
asset-manager/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
│
├── server/                          # Express API server
│   ├── index.ts                     # Entry point (port 3001)
│   ├── db.ts                        # SQLite init, schema, seed data
│   ├── routes/
│   │   ├── accounts.ts              # GET/POST/PUT/DELETE /api/accounts
│   │   ├── transactions.ts          # GET/POST/PUT/DELETE /api/transactions
│   │   ├── import.ts                # POST /api/import/preview|confirm
│   │   ├── categories.ts            # /api/categories CRUD
│   │   ├── holdings.ts              # GET /api/holdings
│   │   ├── analytics.ts             # GET /api/analytics/bank|securities
│   │   ├── backup.ts                # POST /api/backup/export|import
│   │   ├── settings.ts              # GET/PUT /api/settings
│   │   ├── profiles.ts              # /api/profiles CRUD
│   │   ├── prices.ts                # Stock price cache endpoints
│   │   ├── stocks.ts                # Naver Finance stock search
│   │   └── summary.ts               # GET /api/summary (dashboard totals)
│   ├── services/
│   │   └── portfolioHistory.ts      # Portfolio value history builder
│   └── utils/
│       ├── parser.ts                # CSV/XLS/PDF parsing + column mapping
│       ├── hash.ts                  # SHA-256 deduplication hash
│       ├── encoding.ts              # EUC-KR auto-detection
│       ├── xlsParser.ts             # Excel multi-sheet parser
│       ├── pdfParser.ts             # PDF table extraction
│       └── naverFinance.ts          # Naver Finance API client
│
└── src/                             # React frontend
    ├── main.tsx
    ├── App.tsx
    ├── api/
    │   └── client.ts                # Fetch wrapper for all API calls
    ├── context/
    │   └── AppContext.tsx           # Global state (React Context + useReducer)
    ├── hooks/                       # useAccounts, useTransactions, useSettings, etc.
    ├── types/
    │   └── index.ts                 # Shared TypeScript types
    ├── pages/
    │   ├── SettingsPage.tsx
    │   └── ...
    ├── utils/
    │   └── export.ts                # CSV/Excel export helpers
    └── components/
        ├── layout/                  # Sidebar, MainContent
        ├── dashboard/               # KPI cards, recent transactions
        ├── accounts/                # AccountList, AccountForm modal
        ├── transactions/            # TransactionTable, TransactionForm, SearchFilterBar
        ├── import/                  # ImportModal (multi-step wizard), ImportHistory
        ├── analytics/               # BankAnalytics, SecuritiesAnalytics charts
        ├── securities/              # SecuritiesAccountPage, HoldingsTable
        ├── categories/              # CategoryList, CategoryForm modal
        ├── settings/                # BackupSection, GeneralSettings, ProfileList/Form
        └── common/                  # Toast, LoadingSkeleton, shared UI
```

---

## Database Schema

The database file `asset-manager.db` is created automatically in the project root.

| Table | Description |
|---|---|
| `accounts` | Bank and securities accounts |
| `bank_transactions` | Bank transaction records (income/expense) |
| `securities_transactions` | Securities trade records (buy/sell/dividend/etc.) |
| `categories` | Income and expense categories |
| `institution_profiles` | Column mapping presets per institution |
| `holdings` | Computed securities holdings (current positions) |
| `price_cache` | Cached stock prices from Naver Finance |
| `import_history` | Log of all file imports |
| `app_settings` | Key-value app settings (name, currency, date format) |

**Duplicate detection**: Each imported transaction gets a SHA-256 hash of `(account_id + date + amount + payee/security)`. Re-importing the same file is safe — duplicates are automatically skipped.

---

## Importing Transactions

1. Select an account in the sidebar
2. Click **거래내역 가져오기** (Import)
3. Choose your file (CSV, Excel, or PDF)
4. Select your institution from the dropdown — if a preset exists, columns are mapped automatically
5. Review the preview (new rows vs. duplicates)
6. Click **확인** to import

### Supported Institutions (pre-configured)

**Banks**: KB국민, 신한, 하나, 우리, NH농협, IBK기업, SC제일  
**Brokerages**: 키움, 미래에셋, 삼성, 한국투자, NH투자, KB증권

For other institutions, use the manual column mapping UI.

---

## UI Conventions

- **Amounts**: Income in blue (`+₩1,234,567`), expenses in red (`-₩1,234,567`)
- **Currency**: Korean won `₩` with thousand-separator commas
- **Dates**: `YYYY-MM-DD` format throughout
- **Language**: Korean UI labels; font uses Pretendard or system-ui fallback

---

## Known Notes

- The SQLite module prints `ExperimentalWarning: SQLite is an experimental feature` on startup — this is expected and harmless on Node.js v22/v24.
- Stock prices are fetched from Naver Finance. If a security's ticker code is not set, use the ticker search button (돋보기 아이콘) in the Holdings table to assign the correct code.
