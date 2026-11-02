// Proxy to Financial Modeling Prep. The browser never sees your API key.
// GET /api/fmp/<endpoint>?<params>  ->  https://financialmodelingprep.com/stable/<endpoint>
import { checkAuth, json, fmp } from '../lib/lib.mjs';

// Only endpoints the app uses are allowed through.
const ALLOWED = new Set([
  'search-symbol', 'search-name', 'profile', 'quote', 'batch-quote',
  'income-statement', 'balance-sheet-statement', 'cash-flow-statement',
  'ratios', 'ratios-ttm', 'key-metrics', 'key-metrics-ttm', 'financial-scores',
  'analyst-estimates', 'price-target-consensus', 'grades-consensus',
  'stock-peers', 'revenue-product-segmentation', 'revenue-geographic-segmentation',
  'key-executives', 'governance-executive-compensation',
  'insider-trading/search', 'news/stock', 'news/press-releases',
  'earnings', 'earnings-calendar', 'earning-call-transcript',
  'earning-call-transcript-dates', 'historical-price-eod/light',
  'industry-pe-snapshot', 'sector-pe-snapshot', 'sec-filings-search/symbol',
  'dividends', 'shares-float',
]);

export default async (req) => {
  const denied = checkAuth(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const endpoint = url.pathname.replace(/^\/api\/fmp\//, '').replace(/\/+$/, '');
  if (!ALLOWED.has(endpoint)) return json({ error: `endpoint not allowed: ${endpoint}` }, 400);
  const params = Object.fromEntries(url.searchParams.entries());
  try {
    const { status, data } = await fmp(endpoint, params);
    return json(data, status);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
};

export const config = { path: '/api/fmp/*' };
