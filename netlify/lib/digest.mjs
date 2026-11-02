// Builds the daily briefing: who reports today, what's coming for your
// watchlist, last night's results, and watchlist news/moves.
import { getStore } from '@netlify/blobs';
import { fmp, env } from './lib.mjs';

export function etDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d); // YYYY-MM-DD
}

const isUS = (s) => s && !s.includes('.') && !s.includes('-') && s.length <= 5;

export async function buildDigest() {
  const store = getStore('thesis');
  const user = (await store.get('userdata', { type: 'json' })) || { watchlist: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL'] };
  const watch = (user.watchlist || []).map((s) => s.toUpperCase());
  const today = etDate(0);
  const yesterday = etDate(-1);
  const in14 = etDate(14);

  const cal = await fmp('earnings-calendar', { from: yesterday, to: in14 });
  const rows = Array.isArray(cal.data) ? cal.data : [];

  const todayAll = rows
    .filter((r) => r.date === today && isUS(r.symbol))
    .sort((a, b) => (b.revenueEstimated || 0) - (a.revenueEstimated || 0));
  const watchUpcoming = rows
    .filter((r) => watch.includes(r.symbol) && r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const watchReported = rows
    .filter((r) => watch.includes(r.symbol) && r.date <= today && r.epsActual != null)
    .map((r) => ({
      ...r,
      epsSurprisePct: r.epsEstimated ? ((r.epsActual - r.epsEstimated) / Math.abs(r.epsEstimated)) * 100 : null,
      revSurprisePct: r.revenueEstimated && r.revenueActual ? ((r.revenueActual - r.revenueEstimated) / r.revenueEstimated) * 100 : null,
    }));

  // Quotes + news for the watchlist (kept small to respect API limits).
  const quotes = [];
  const news = [];
  for (const sym of watch.slice(0, 25)) {
    try {
      const q = await fmp('quote', { symbol: sym });
      if (Array.isArray(q.data) && q.data[0]) quotes.push(q.data[0]);
    } catch { /* skip */ }
  }
  try {
    const n = await fmp('news/stock', { symbols: watch.slice(0, 25).join(','), limit: '40' });
    if (Array.isArray(n.data)) news.push(...n.data.slice(0, 40));
  } catch { /* skip */ }

  const digest = {
    generatedAt: new Date().toISOString(),
    date: today,
    todayCount: todayAll.length,
    today: todayAll.slice(0, 60),
    watchUpcoming,
    watchReported,
    quotes,
    news,
  };
  await store.setJSON('digest', digest);
  return digest;
}

const fmtM = (n) => (n == null ? '—' : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : `$${(n / 1e6).toFixed(0)}M`);

export function digestText(d) {
  const lines = [`Thesis daily briefing — ${d.date}`, ''];
  lines.push(`REPORTING TODAY (${d.todayCount} US companies, largest first):`);
  for (const r of d.today.slice(0, 20)) lines.push(`  ${r.symbol}  EPS est ${r.epsEstimated ?? '—'}  Rev est ${fmtM(r.revenueEstimated)}`);
  lines.push('');
  if (d.watchReported.length) {
    lines.push('YOUR WATCHLIST — RECENT RESULTS:');
    for (const r of d.watchReported) lines.push(`  ${r.symbol} (${r.date})  EPS ${r.epsActual} vs ${r.epsEstimated ?? '—'}${r.epsSurprisePct != null ? ` (${r.epsSurprisePct.toFixed(1)}%)` : ''}`);
    lines.push('');
  }
  lines.push('YOUR WATCHLIST — UPCOMING (14 days):');
  if (!d.watchUpcoming.length) lines.push('  none');
  for (const r of d.watchUpcoming) lines.push(`  ${r.date}  ${r.symbol}  EPS est ${r.epsEstimated ?? '—'}`);
  lines.push('');
  if (d.quotes.length) {
    lines.push('WATCHLIST MOVES:');
    for (const q of d.quotes) lines.push(`  ${q.symbol}  $${q.price?.toFixed?.(2)}  ${q.changePercentage?.toFixed?.(2) ?? q.changesPercentage?.toFixed?.(2) ?? ''}%`);
  }
  return lines.join('\n');
}

export async function sendDigest(d) {
  const text = digestText(d);
  const out = [];
  const resend = env('RESEND_API_KEY');
  const to = env('ALERT_EMAIL');
  if (resend && to) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${resend}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env('ALERT_FROM') || 'Thesis <onboarding@resend.dev>',
        to: [to],
        subject: `Earnings today: ${d.today.slice(0, 6).map((r) => r.symbol).join(', ') || 'none'} — Thesis ${d.date}`,
        text,
      }),
    });
    out.push(`email ${r.status}`);
  }
  const topic = env('NTFY_TOPIC');
  if (topic) {
    const watchToday = d.watchUpcoming.filter((r) => r.date === d.date).map((r) => r.symbol);
    const body = `${d.todayCount} companies report today. Biggest: ${d.today.slice(0, 8).map((r) => r.symbol).join(', ')}` +
      (watchToday.length ? `\nYour watchlist today: ${watchToday.join(', ')}` : '');
    const r = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers: { Title: `Thesis — earnings ${d.date}`, Tags: 'chart_with_upwards_trend' },
      body,
    });
    out.push(`push ${r.status}`);
  }
  return out;
}
