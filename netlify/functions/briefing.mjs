// GET /api/briefing            -> today's saved briefing (builds one if missing/stale)
// GET /api/briefing?refresh=1  -> rebuild now
// POST /api/briefing?send=1    -> rebuild and send email/push (test your alerts)
import { getStore } from '@netlify/blobs';
import { checkAuth, json } from '../lib/lib.mjs';
import { buildDigest, sendDigest, etDate } from '../lib/digest.mjs';

export default async (req) => {
  const denied = checkAuth(req);
  if (denied) return denied;
  const url = new URL(req.url);
  try {
    if (req.method === 'POST' && url.searchParams.get('send')) {
      const d = await buildDigest();
      const sent = await sendDigest(d);
      return json({ ...d, sent });
    }
    const store = getStore('thesis');
    let d = await store.get('digest', { type: 'json' });
    if (url.searchParams.get('refresh') || !d || d.date !== etDate(0)) d = await buildDigest();
    return json(d);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
};

export const config = { path: '/api/briefing' };
