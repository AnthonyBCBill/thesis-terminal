// Shared helpers for all Thesis functions.

export const env = (k) => (globalThis.Netlify?.env?.get?.(k) ?? process.env[k] ?? '');

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...extra },
  });
}

// Simple personal-app lock: if APP_PASSWORD is set, every request must send it
// in the x-app-key header. Keeps strangers from burning your API quotas.
export function checkAuth(req) {
  const pw = env('APP_PASSWORD');
  if (!pw) return null;
  const sent = req.headers.get('x-app-key') || '';
  if (sent !== pw) return json({ error: 'unauthorized' }, 401);
  return null;
}

const FMP_BASE = 'https://financialmodelingprep.com/stable/';

// Server-side FMP fetch (used by the proxy and by the scheduled digest).
export async function fmp(path, params = {}) {
  const key = env('FMP_API_KEY');
  if (!key) throw new Error('FMP_API_KEY is not set');
  const qs = new URLSearchParams({ ...params, apikey: key });
  const res = await fetch(FMP_BASE + path + '?' + qs.toString());
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 300) }; }
  return { status: res.status, data };
}
