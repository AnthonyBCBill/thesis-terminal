// Browser-side data access. All market data goes through /api/fmp (your key stays on Netlify).

const CACHE_PREFIX = 'thesis:c:';
const TTL = {
  default: 24 * 3600e3, // statements, segments, estimates — refresh daily (saves free-plan requests)
  profile: 30 * 60e3, // price lives here
  quote: 5 * 60e3,
  'historical-price-eod/light': 12 * 3600e3,
  'earnings-calendar': 30 * 60e3,
  'news/stock': 15 * 60e3,
  'news/press-releases': 30 * 60e3,
  'earning-call-transcript': 30 * 24 * 3600e3,
};

export const getAppKey = () => localStorage.getItem('thesis:appkey') || '';
export const setAppKey = (k) => localStorage.setItem('thesis:appkey', k);

// ---- Free-plan helpers ----
export const isEco = () => localStorage.getItem('thesis:eco') !== '0'; // economy mode on by default
export const setEco = (on) => localStorage.setItem('thesis:eco', on ? '1' : '0');
const today = () => new Date().toISOString().slice(0, 10);
export function usageToday() {
  try { const u = JSON.parse(localStorage.getItem('thesis:usage')); return u?.d === today() ? u.n : 0; } catch { return 0; }
}
function countRequest() {
  try { localStorage.setItem('thesis:usage', JSON.stringify({ d: today(), n: usageToday() + 1 })); } catch { /* ignore */ }
}
// Endpoints your plan doesn't include are remembered for a week so we stop spending requests on them.
const NA_KEY = 'thesis:na';
const naMap = () => { try { return JSON.parse(localStorage.getItem(NA_KEY)) || {}; } catch { return {}; } };
const isUnavailable = (ep) => { const t = naMap()[ep]; return t && Date.now() - t < 7 * 864e5; };
function markUnavailable(ep) { const m = naMap(); m[ep] = Date.now(); localStorage.setItem(NA_KEY, JSON.stringify(m)); }
export const unavailableList = () => Object.keys(naMap()).filter(isUnavailable);
export const resetUnavailable = () => localStorage.removeItem(NA_KEY);
const PLAN_ERR = /premium|subscription|upgrade|plan|not available|special endpoint|restricted/i;

export class ApiError extends Error {
  constructor(msg, status) { super(msg); this.status = status; }
}

function readCache(key, ttl) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { t, d } = JSON.parse(raw);
    if (Date.now() - t > ttl) return null;
    return d;
  } catch { return null; }
}
function writeCache(key, d) {
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); }
  catch {
    // Storage full: drop old cache entries and move on.
    Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX)).slice(0, 200).forEach((k) => localStorage.removeItem(k));
  }
}

const inflight = new Map();

export async function fmp(endpoint, params = {}, { fresh = false } = {}) {
  const qs = new URLSearchParams(params).toString();
  const key = CACHE_PREFIX + endpoint + '?' + qs;
  const ttl = TTL[endpoint] ?? TTL.default;
  if (!fresh) {
    const c = readCache(key, ttl);
    if (c) return c;
  }
  if (inflight.has(key)) return inflight.get(key);
  if (isUnavailable(endpoint)) throw new ApiError('Not included in your FMP plan', 402);
  const p = (async () => {
    countRequest();
    const res = await fetch(`/api/fmp/${endpoint}?${qs}`, { headers: { 'x-app-key': getAppKey() } });
    let data;
    try { data = await res.json(); } catch { data = null; }
    if (res.status === 401) throw new ApiError('Locked — enter your app password in Settings', 401);
    if (!res.ok) {
      const msg = (data && (data.error || data['Error Message'] || data.message)) || `HTTP ${res.status}`;
      if ((res.status === 402 || res.status === 403) && PLAN_ERR.test(String(msg)) && !('limit' in params && +params.limit > 5)) markUnavailable(endpoint);
      if (res.status === 429 || /limit reach/i.test(String(msg))) throw new ApiError('Daily FMP request limit reached — data resumes tomorrow (or upgrade your FMP plan).', 429);
      throw new ApiError(String(msg), res.status);
    }
    if (data && !Array.isArray(data) && data['Error Message']) {
      const msg = data['Error Message'];
      if (PLAN_ERR.test(msg)) markUnavailable(endpoint);
      throw new ApiError(msg, 402);
    }
    writeCache(key, data);
    return data;
  })();
  inflight.set(key, p);
  try { return await p; } finally { inflight.delete(key); }
}

// Like fmp() but never throws — returns fallback, and records the error.
export async function fmpSafe(endpoint, params, fallback = []) {
  try { return { data: await fmp(endpoint, params), error: null }; }
  catch (e) {
    // Free plans cap history; retry once with a 5-period limit.
    if (params?.limit && +params.limit > 5 && e.status !== 429) {
      try { return { data: await fmp(endpoint, { ...params, limit: 5 }), error: null }; } catch { /* fall through */ }
    }
    return { data: fallback, error: e.message };
  }
}

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', 'x-app-key': getAppKey(), ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError((data && data.error) || `HTTP ${res.status}`, res.status);
  return data;
}

export function clearCache() {
  Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX)).forEach((k) => localStorage.removeItem(k));
}
