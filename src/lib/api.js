// Browser-side data access. All market data goes through /api/fmp (your key stays on Netlify).

const CACHE_PREFIX = 'thesis:c:';
const TTL = {
  default: 6 * 3600e3, // statements, profiles, segments
  quote: 60e3,
  'earnings-calendar': 30 * 60e3,
  'news/stock': 15 * 60e3,
  'news/press-releases': 30 * 60e3,
  'earning-call-transcript': 30 * 24 * 3600e3,
};

export const getAppKey = () => localStorage.getItem('thesis:appkey') || '';
export const setAppKey = (k) => localStorage.setItem('thesis:appkey', k);

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
  const p = (async () => {
    const res = await fetch(`/api/fmp/${endpoint}?${qs}`, { headers: { 'x-app-key': getAppKey() } });
    let data;
    try { data = await res.json(); } catch { data = null; }
    if (res.status === 401) throw new ApiError('Locked — enter your app password in Settings', 401);
    if (!res.ok) {
      const msg = (data && (data.error || data['Error Message'] || data.message)) || `HTTP ${res.status}`;
      throw new ApiError(String(msg), res.status);
    }
    if (data && !Array.isArray(data) && data['Error Message']) throw new ApiError(data['Error Message'], 402);
    writeCache(key, data);
    return data;
  })();
  inflight.set(key, p);
  try { return await p; } finally { inflight.delete(key); }
}

// Like fmp() but never throws — returns fallback, and records the error.
export async function fmpSafe(endpoint, params, fallback = []) {
  try { return { data: await fmp(endpoint, params), error: null }; }
  catch (e) { return { data: fallback, error: e.message }; }
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
