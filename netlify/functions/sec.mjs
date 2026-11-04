// GET /api/sec?symbol=DOCN -> annual + quarterly statements from SEC filings (free, all US filers).
// Cached in Netlify Blobs for 24 hours per ticker.
import { getStore } from '@netlify/blobs';
import { checkAuth, json } from '../lib/lib.mjs';
import { secStatements } from '../lib/sec.mjs';

export default async (req) => {
  const denied = checkAuth(req);
  if (denied) return denied;
  const symbol = (new URL(req.url).searchParams.get('symbol') || '').toUpperCase().trim();
  if (!/^[A-Z.\-]{1,10}$/.test(symbol)) return json({ error: 'symbol required' }, 400);
  const store = getStore('thesis');
  const key = `sec:${symbol}`;
  const cached = await store.get(key, { type: 'json' });
  if (cached && Date.now() - cached._t < 24 * 3600e3) return json(cached);
  try {
    const data = await secStatements(store, symbol);
    if (!data.error) await store.setJSON(key, { ...data, _t: Date.now() });
    return json(data, data.error ? 404 : 200);
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};

export const config = { path: '/api/sec' };
