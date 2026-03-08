import axios from 'axios';
import type { StockPrice } from './naverFinance';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

/**
 * Fetch a foreign (US) stock price from Stooq.com.
 * URL: https://stooq.com/q/l/?s={ticker}.US&f=sd2t2ohlcvn&h&e=csv
 * Returns CSV: Symbol,Date,Time,Open,High,Low,Close,Volume,Name
 */
export async function fetchStooqStockPrice(symbol: string): Promise<StockPrice | null> {
  try {
    const s = symbol.toUpperCase();
    const url = `https://stooq.com/q/l/?s=${encodeURIComponent(s)}.US&f=sd2t2ohlcvn&h&e=csv`;
    const { data } = await axios.get<string>(url, { headers: HEADERS, timeout: 8000, responseType: 'text' });

    // Parse CSV — skip header line, read data line
    const lines = data.trim().split('\n');
    if (lines.length < 2) return null;
    const cols = lines[1].split(',');
    // Symbol,Date,Time,Open,High,Low,Close,Volume,Name
    if (cols.length < 9) return null;
    const closeStr = cols[6]?.trim();
    const openStr  = cols[3]?.trim();
    if (!closeStr || closeStr === 'N/D') return null;

    const currentPrice = parseFloat(closeStr);
    if (!currentPrice || isNaN(currentPrice)) return null;

    const openPrice  = parseFloat(openStr) || currentPrice;
    // Stooq doesn't provide prev_close directly; approximate with open price
    const changeAmt  = currentPrice - openPrice;
    const changeRate = openPrice > 0 ? (changeAmt / openPrice) * 100 : 0;
    const name = cols.slice(8).join(',').trim() || s;

    return {
      security_code: s,
      security_name: name,
      current_price: currentPrice,
      prev_close: openPrice,
      change_amount: changeAmt,
      change_rate: changeRate,
      market: 'UNKNOWN',
      fetched_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Sequential with delay to avoid rate limiting
const REQUEST_DELAY_MS = 600;

export async function fetchStooqStockPrices(symbols: string[]): Promise<StockPrice[]> {
  const results: StockPrice[] = [];
  for (const sym of symbols) {
    const price = await fetchStooqStockPrice(sym);
    if (price) results.push(price);
    await sleep(REQUEST_DELAY_MS);
  }
  return results;
}
