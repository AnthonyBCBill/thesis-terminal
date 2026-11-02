// Next earnings date for every watchlist stock — one calendar request covers the next ~60 days.
import { useEffect, useState } from 'react';
import { fmp } from './api.js';

const iso = (d) => d.toISOString().slice(0, 10);

export async function loadUpcoming(days = 60) {
  const from = iso(new Date());
  const to = iso(new Date(Date.now() + days * 864e5));
  try {
    const rows = await fmp('earnings-calendar', { from, to });
    const map = {};
    for (const r of Array.isArray(rows) ? rows : []) {
      if (!map[r.symbol] || r.date < map[r.symbol].date) map[r.symbol] = r;
    }
    return map;
  } catch { return {}; }
}

// Returns { map, rows } where rows = watchlist stocks with a date, soonest first, plus ones with no date in range.
export function useWatchlistEarnings(watchlist) {
  const [map, setMap] = useState(null);
  useEffect(() => { loadUpcoming().then(setMap); }, []);
  if (!map) return { loading: true, rows: [], map: {} };
  const rows = watchlist.map((s) => ({ symbol: s, ...(map[s] || {}), hasDate: !!map[s] }))
    .sort((a, b) => (a.hasDate === b.hasDate ? String(a.date || '').localeCompare(String(b.date || '')) : a.hasDate ? -1 : 1));
  return { loading: false, rows, map };
}
