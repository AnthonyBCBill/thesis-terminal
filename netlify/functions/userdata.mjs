// Stores your watchlist, notes and saved peer groups in Netlify Blobs so they
// follow you across devices and the daily briefing knows what you own/watch.
// GET /api/userdata  -> { watchlist, notes, peers, settings }
// PUT /api/userdata  <- full object
import { getStore } from '@netlify/blobs';
import { checkAuth, json } from '../lib/lib.mjs';

const EMPTY = { watchlist: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL'], notes: {}, peers: {}, settings: {} };

export default async (req) => {
  const denied = checkAuth(req);
  if (denied) return denied;
  const store = getStore('thesis');
  if (req.method === 'GET') {
    const data = await store.get('userdata', { type: 'json' });
    return json(data || EMPTY);
  }
  if (req.method === 'PUT') {
    const body = await req.json();
    await store.setJSON('userdata', { ...EMPTY, ...body, updatedAt: new Date().toISOString() });
    return json({ ok: true });
  }
  return json({ error: 'method not allowed' }, 405);
};

export const config = { path: '/api/userdata' };
