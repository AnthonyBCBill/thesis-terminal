export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function money(v, digits = 1) {
  if (!isNum(v)) return '—';
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e12) return `${s}$${(a / 1e12).toFixed(digits)}T`;
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(digits)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(digits)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(digits)}K`;
  return `${s}$${a.toFixed(2)}`;
}
export const num = (v, d = 2) => (isNum(v) ? v.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }) : '—');
export const int = (v) => (isNum(v) ? Math.round(v).toLocaleString() : '—');
export const pct = (v, d = 1) => (isNum(v) ? `${(v * 100).toFixed(d)}%` : '—'); // v is a fraction
export const pctRaw = (v, d = 1) => (isNum(v) ? `${v.toFixed(d)}%` : '—'); // v already in %
export const mult = (v, d = 1) => (isNum(v) ? (v < 0 ? 'NM' : `${v.toFixed(d)}x`) : '—');
export const price = (v) => (isNum(v) ? `$${v.toFixed(2)}` : '—');
export const signPct = (v, d = 1) => (isNum(v) ? `${v > 0 ? '+' : ''}${(v * 100).toFixed(d)}%` : '—');

export const tone = (v) => (!isNum(v) ? '' : v > 0 ? 'pos' : v < 0 ? 'neg' : '');

export function shortDate(s) {
  if (!s) return '—';
  const d = new Date(s.length === 10 ? s + 'T12:00:00' : s);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function axisMoney(v) {
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
  if (a >= 1e9) return `${(v / 1e9).toFixed(0)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  return String(v);
}
// Net debt / EBITDA: negative means the company holds more cash than debt.
export const lev = (v, d = 1) => (isNum(v) ? (v < 0 ? 'Net cash' : `${v.toFixed(d)}x`) : '—');
