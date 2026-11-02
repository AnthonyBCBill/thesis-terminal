// Next and most-recent earnings for every watchlist stock.
// Two calendar requests: the last ~75 days (what was just announced) and the next 90 (what's coming).
import { useEffect, useState } from 'react';
import { fmp } from './api.js';

const iso = (d) => d.toISOString().slice(0, 10);
const day = (n) => iso(new Date(Date.now() + n * 864e5));

async function range(from, to) {
  try { const r = await fmp('earnings-calendar', { from, to }); return Array.isArray(r) ? r : []; } catch { return []; }
}

export async function loadEarningsMaps() {
  const today = day(0);
  const [past, future] = await Promise.all([range(day(-75), day(-1)), range(today, day(90))]);
  const next = {}, last = {};
  for (const r of [...past, ...future]) {
    const reported = r.epsActual != null;
    if (reported) { if (!last[r.symbol] || r.date > last[r.symbol].date) last[r.symbol] = r; }
    else if (r.date >= today) { if (!next[r.symbol] || r.date < next[r.symbol].date) next[r.symbol] = r; }
  }
  return { next, last };
}

export const surprise = (r) => (r && r.epsActual != null && r.epsEstimated ? (r.epsActual - r.epsEstimated) / Math.abs(r.epsEstimated) : null);

// rows: every watchlist stock with { next, last }, soonest upcoming first.
export function useWatchlistEarnings(watchlist) {
  const [maps, setMaps] = useState(null);
  useEffect(() => { loadEarningsMaps().then(setMaps); }, []);
  if (!maps) return { loading: true, rows: [], map: {}, last: {} };
  const rows = watchlist.map((s) => {
    const n = maps.next[s];
    return { symbol: s, ...(n || {}), hasDate: !!n, last: maps.last[s] || null };
  }).sort((a, b) => (a.hasDate === b.hasDate ? String(a.date || '').localeCompare(String(b.date || '')) : a.hasDate ? -1 : 1));
  return { loading: false, rows, map: maps.next, last: maps.last };
}
