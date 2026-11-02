import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmp } from '../lib/api.js';
import { useUserData } from '../lib/userdata.jsx';
import { useWatchlistEarnings } from '../lib/upcoming.js';
import { Card, DataTable, Loading, Err, Seg } from '../components/ui.jsx';
import { exportRows } from '../lib/excel.js';
import { money, num, pctRaw, tone } from '../lib/format.js';

const iso = (d) => d.toISOString().slice(0, 10);
const monday = (d) => { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(12); return x; };
const isUS = (s) => s && !s.includes('.') && !s.includes('-') && s.length <= 5;

export default function Calendar() {
  const [week, setWeek] = useState(() => monday(new Date()));
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [minRev, setMinRev] = useState(100e6);
  const [scope, setScope] = useState('all');
  const [day, setDay] = useState(null);
  const { data: ud } = useUserData();
  const nav = useNavigate();
  const we = useWatchlistEarnings(ud.watchlist);

  const from = iso(week), toD = new Date(week); toD.setDate(toD.getDate() + 4); const to = iso(toD);
  useEffect(() => {
    setRows(null); setErr('');
    fmp('earnings-calendar', { from, to }).then((d) => setRows(Array.isArray(d) ? d : [])).catch((e) => setErr(e.message));
  }, [from, to]);

  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => { const d = new Date(week); d.setDate(d.getDate() + i); return iso(d); }), [week]);
  const filtered = useMemo(() => (rows || []).filter((r) => isUS(r.symbol))
    .filter((r) => (scope === 'watch' ? ud.watchlist.includes(r.symbol) : (r.revenueEstimated || 0) >= minRev || ud.watchlist.includes(r.symbol)))
    .sort((a, b) => (b.revenueEstimated || 0) - (a.revenueEstimated || 0)), [rows, minRev, scope, ud.watchlist]);
  const byDay = Object.fromEntries(days.map((d) => [d, filtered.filter((r) => r.date === d)]));
  const shown = day ? byDay[day] || [] : filtered;
  const shift = (n) => { const d = new Date(week); d.setDate(d.getDate() + 7 * n); setWeek(d); setDay(null); };

  const cols = [
    { key: 'date', label: 'Date', txt: true }, { key: 'symbol', label: 'Ticker', fmt: (v) => <b className="mono">{v}</b> },
    { key: 'epsEstimated', label: 'EPS est', fmt: (v) => num(v) }, { key: 'epsActual', label: 'EPS actual', fmt: (v) => num(v) },
    { key: 'surprise', label: 'EPS surprise', get: (r) => (r.epsActual != null && r.epsEstimated ? ((r.epsActual - r.epsEstimated) / Math.abs(r.epsEstimated)) * 100 : null), fmt: (v) => pctRaw(v), cls: tone },
    { key: 'revenueEstimated', label: 'Revenue est', fmt: money }, { key: 'revenueActual', label: 'Revenue actual', fmt: money },
  ];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="row">
        <h1>Earnings calendar</h1><span className="spacer" />
        <button className="btn sm" onClick={() => shift(-1)}>‹ Prev</button>
        <button className="btn sm" onClick={() => { setWeek(monday(new Date())); setDay(null); }}>This week</button>
        <button className="btn sm" onClick={() => shift(1)}>Next ›</button>
      </div>
      <Card title="Your watchlist — next earnings" sub="Every stock on your watchlist, soonest first. Add a stock to your watchlist and it appears here.">
        {we.loading ? <Loading h={60} /> : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {we.rows.map((r) => (
              <button key={r.symbol} className="stat" style={{ textAlign: 'left', cursor: 'pointer', color: 'var(--text)' }} onClick={() => nav(`/c/${r.symbol}`)}>
                <div className="mono" style={{ fontWeight: 600 }}>{r.symbol}</div>
                <div className={r.hasDate ? '' : 'sub'} style={{ fontSize: 13 }}>{r.hasDate ? new Date(r.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Not scheduled (90 days)'}</div>
                {r.hasDate && <div className="sub">EPS est {num(r.epsEstimated)}</div>}
              </button>
            ))}
          </div>
        )}
      </Card>
      <div className="row">
        <Seg value={scope} onChange={setScope} options={[{ value: 'all', label: 'All companies' }, { value: 'watch', label: 'My watchlist' }]} />
        {scope === 'all' && (
          <select value={minRev} onChange={(e) => setMinRev(+e.target.value)}>
            <option value={0}>Any size</option><option value={100e6}>Revenue est ≥ $100M / qtr</option>
            <option value={1e9}>≥ $1B / qtr</option><option value={5e9}>≥ $5B / qtr (mega caps)</option>
          </select>
        )}
        <span className="spacer" />
        <button className="btn sm" onClick={() => exportRows(shown, cols.map((c) => ({ ...c, fmt: undefined })), `earnings_${from}`)}>Export to Excel</button>
      </div>
      <Err>{err}</Err>
      {!rows && !err ? <Loading /> : (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10 }}>
            {days.map((d) => (
              <button key={d} onClick={() => setDay(day === d ? null : d)} className="card" style={{ textAlign: 'left', padding: 12, border: day === d ? '1.5px solid var(--accent)' : undefined, color: 'var(--text)' }}>
                <div className="sub">{new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{byDay[d].length}</div>
                <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-2)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{byDay[d].slice(0, 5).map((r) => r.symbol).join(' ')}</div>
              </button>
            ))}
          </div>
          <Card title={day ? `Reporting ${day}` : `Week of ${from}`} sub={`${shown.length} companies · watchlist highlighted · click to research`}>
            {shown.length ? <DataTable rows={shown} cols={cols} highlight={(r) => ud.watchlist.includes(r.symbol)} onRowClick={(r) => nav(`/c/${r.symbol}`)} maxHeight={640} /> : <div className="empty">Nothing matches.</div>}
          </Card>
        </>
      )}
    </div>
  );
}
