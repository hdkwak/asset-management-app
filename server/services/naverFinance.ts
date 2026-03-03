import axios from 'axios';
import { load } from 'cheerio';
import iconv from 'iconv-lite';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://finance.naver.com',
  'Accept-Language': 'ko-KR,ko;q=0.9',
};

export interface StockPrice {
  security_code: string;
  security_name: string;
  current_price: number;
  prev_close: number;
  change_amount: number;
  change_rate: number;
  market: 'KOSPI' | 'KOSDAQ' | 'ETF' | 'UNKNOWN';
  fetched_at: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Primary: Naver Finance polling JSON API
 * https://polling.finance.naver.com/api/realtime/domestic/stock/{code}
 */
async function fetchByPollingApi(code: string): Promise<StockPrice | null> {
  try {
    const url = `https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`;
    const { data } = await axios.get<unknown>(url, { headers: HEADERS, timeout: 5000 });

    if (!data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;

    // Handle two known response shapes
    let item: Record<string, unknown> | null = null;
    if (Array.isArray(d.datas) && d.datas.length > 0) {
      item = d.datas[0] as Record<string, unknown>;
    } else if (d.result && typeof d.result === 'object') {
      const result = d.result as Record<string, unknown>;
      if (Array.isArray(result.areas)) {
        for (const area of result.areas as Array<Record<string, unknown>>) {
          if (Array.isArray(area.datas) && area.datas.length > 0) {
            item = area.datas[0] as Record<string, unknown>;
            break;
          }
        }
      }
    }

    if (!item) return null;

    // New API format (2025+): closePriceRaw, compareToPreviousClosePriceRaw, fluctuationsRatioRaw
    // Old API format: nv=현재가, sv=전일종가, cv=등락액, cr=등락률, rf=등락방향(2=상승,5=하락)
    const isNewFormat = 'closePriceRaw' in item || 'closePrice' in item;

    let currentPrice: number;
    let changeAmt: number;
    let changeRate: number;
    let prevClose: number;
    let name: string;

    if (isNewFormat) {
      // New format — values are already signed; raw fields are numeric strings
      currentPrice = Number(item.closePriceRaw ?? String(item.closePrice ?? '').replace(/[^0-9]/g, '')) || 0;
      if (!currentPrice) return null;
      changeAmt  = Number(item.compareToPreviousClosePriceRaw ?? 0);
      changeRate = Number(item.fluctuationsRatioRaw ?? 0);
      prevClose  = currentPrice - changeAmt;
      name = String(item.stockName ?? item.nm ?? item.name ?? code);
    } else {
      // Old format — apply sign separately
      currentPrice = Number(item.nv ?? 0);
      if (!currentPrice) return null;
      prevClose  = Number(item.sv ?? item.ov ?? 0) || currentPrice;
      changeAmt  = Number(item.cv ?? 0);
      changeRate = Number(item.cr ?? item.rt ?? 0);
      name = String(item.nm ?? item.name ?? code);
      const rf = String(item.rf ?? '3');
      const sign = rf === '5' ? -1 : rf === '2' ? 1 : 0;
      changeAmt  = sign * Math.abs(changeAmt);
      changeRate = sign * Math.abs(changeRate);
    }

    return {
      security_code: code,
      security_name: name,
      current_price: currentPrice,
      prev_close: prevClose || currentPrice,
      change_amount: changeAmt,
      change_rate: changeRate,
      market: 'UNKNOWN',
      fetched_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Fallback: parse Naver Finance item HTML page.
 * Uses EUC-KR decoding since Naver Finance pages are EUC-KR encoded.
 */
async function fetchByHtmlParse(code: string): Promise<StockPrice | null> {
  try {
    const url = `https://finance.naver.com/item/main.naver?code=${code}`;
    const { data: raw } = await axios.get<ArrayBuffer>(url, {
      headers: HEADERS,
      timeout: 8000,
      responseType: 'arraybuffer',
    });

    const html = iconv.decode(Buffer.from(raw), 'euc-kr');
    const $ = load(html);

    // Stock name from page title "삼성전자 : 네이버 금융"
    const name = $('title').text().split(':')[0].trim() || code;

    // Current price
    const priceText = $('.no_today .p1').first().text().replace(/[^0-9]/g, '');
    const currentPrice = parseInt(priceText, 10);
    if (!currentPrice) return null;

    // Change direction and values
    const isDown =
      $('.no_today .down, .no_today em.nv_down').length > 0 ||
      $('.no_today .blind:contains("하락")').length > 0;
    const changeText = $('.no_today .p2').first().text().replace(/[^0-9]/g, '');
    const changeAmt = parseInt(changeText, 10) || 0;
    const rateText = $('.no_today .p3').first().text().replace(/[^0-9.]/g, '');
    const changeRate = parseFloat(rateText) || 0;

    const sign = isDown ? -1 : 1;

    return {
      security_code: code,
      security_name: name,
      current_price: currentPrice,
      prev_close: currentPrice - sign * changeAmt || currentPrice,
      change_amount: sign * changeAmt,
      change_rate: sign * changeRate,
      market: 'UNKNOWN',
      fetched_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function fetchStockPrice(code: string): Promise<StockPrice | null> {
  const result = await fetchByPollingApi(code);
  if (result) return result;
  return fetchByHtmlParse(code);
}

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 300;

export async function fetchStockPrices(codes: string[]): Promise<StockPrice[]> {
  const results: StockPrice[] = [];
  for (let i = 0; i < codes.length; i += BATCH_SIZE) {
    const batch = codes.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map((c) => fetchStockPrice(c)));
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value) results.push(s.value);
    }
    if (i + BATCH_SIZE < codes.length) await sleep(BATCH_DELAY_MS);
  }
  return results;
}

/**
 * Search stocks by name or code using Naver Finance autocomplete API.
 * Returns up to 10 results.
 */
export async function searchStock(
  query: string
): Promise<Array<{ code: string; name: string; market: string }>> {
  try {
    const { data } = await axios.get<unknown>(
      'https://ac.finance.naver.com/namevalue/searchlist.naver',
      {
        params: { query, target: 'stocks,marketindicator' },
        headers: HEADERS,
        timeout: 5000,
      }
    );

    if (!Array.isArray(data)) return [];

    return (data as unknown[][])
      .slice(0, 10)
      .map((item) => ({
        code: String(item[0] ?? '').trim(),
        name: String(item[1] ?? '').trim(),
        market: mapMarketName(String(item[3] ?? '')),
      }))
      .filter((r) => r.code.length > 0 && r.name.length > 0);
  } catch {
    return [];
  }
}

function mapMarketName(raw: string): string {
  if (/코스피|KOSPI/i.test(raw)) return 'KOSPI';
  if (/코스닥|KOSDAQ/i.test(raw)) return 'KOSDAQ';
  if (/ETF/i.test(raw)) return 'ETF';
  return raw || 'UNKNOWN';
}
