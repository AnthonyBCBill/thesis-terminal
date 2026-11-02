import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useUserData } from '../lib/userdata.jsx';
import { useWatchlistEarnings, surprise } from '../lib/upcoming.js';
import { Card, DataTable, Loading, Err, Icon, Spinner } from '../components/ui.jsx';
import { money, num, price, shortDate, pctRaw, tone } from '../lib/format.js';

const dayName = (d) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const { data: ud } = useUserData();
  const nav = useNavigate();

  const load = async (refresh) => {
    setBusy(refresh ? 'refresh' : ''); setErr('');
    try { setD(await api(`/api/briefing${refresh ? '?refresh=1' : ''}`)); } catch (e) { setErr(e.message); }
    setBusy('');
  };
  useEffect(() => { load(false); }, []);

  const sendTest = async () => {
    setBusy('send');
    try { const r = await api('/api/briefing?send=1', { method: 'POST' }); setD(r); alertMsg(r.sent?.length ? `Sent: ${r.sent.join(', ')}` : 'No alert channels configured — see Settings.'); }
    catch (e) { setErr(e.message); }
    setBusy('');
  };
  const [msg, alertMsg] = useState('');

  // Live from the earnings calendar so newly-added watchlist stocks show immediately.
  const we = useWatchlistEarnings(ud.watchlist);
  const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  const upcoming = we.rows.filter((r) => r.hasDate);
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const watchToday = upcoming.filter((r) => r.date === todayIso);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="row">
        <div><h1>Daily briefing</h1><div className="sub">{today}{d && ` · updated ${new Date(d.generatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}</div></div>
        <span className="spacer" />
        <button className="btn" onClick={sendTest} disabled={!!busy}>{busy === 'send' ? <Spinner /> : null}Send me today's alert</button>
        <button className="btn" onClick={() => load(true)} disabled={!!busy}>{busy === 'refresh' ? <Spinner /> : <Icon name="refresh" size={14} />}Refresh</button>
      </div>
      {msg && <div className="info-box">{msg}</div>}
      {err && <Err>{err} {err.includes('Locked') || err.includes('unauthorized') ? <Link to="/settings">Open Settings</Link> : null}</Err>}
      {!d && !err && <Loading label="Building today's briefing…" h={240} />}

      {d && (
        <>
          <div className="stats">
            <div className="stat"><div className="l">Companies reporting today</div><div className="v">{d.todayCount}</div><div className="s">US listings</div></div>
            <div className="stat"><div className="l">Your watchlist today</div><div className="v">{watchToday.length}</div><div className="s">{watchToday.map((r) => r.symbol).join(', ') || 'None'}</div></div>
            <div className="stat"><div className="l">Watchlist next 90 days</div><div className="v">{upcoming.length}</div><div className="s">{upcoming.slice(0, 4).map((r) => r.symbol).join(', ')}</div></div>
            <div className="stat"><div className="l">Watchlist recent results</div><div className="v">{d.watchReported.length}</div><div className="s">{d.watchReported.filter((r) => r.epsSurprisePct > 0).length} beat EPS</div></div>
          </div>

          <div className="grid g2" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', alignItems: 'start' }}>
            <Card title="Reporting today" sub="Largest first (by revenue estimate). Click to research." right={<Link to="/calendar" className="btn sm">Full calendar</Link>}>
              {d.today.length ? <DataTable maxHeight={520} rows={d.today} highlight={(r) => ud.watchlist.includes(r.symbol)} onRowClick={(r) => nav(`/c/${r.symbol}`)} cols={[
                { key: 'symbol', label: 'Ticker', fmt: (v) => <b className="mono">{v}</b> },
                { key: 'epsEstimated', label: 'EPS est', fmt: (v) => num(v) },
                { key: 'revenueEstimated', label: 'Revenue est', fmt: money },
                { key: 'epsActual', label: 'EPS actual', fmt: (v) => num(v) },
                { key: 'surprise', label: 'Surprise', get: (r) => (r.epsActual != null && r.epsEstimated ? ((r.epsActual - r.epsEstimated) / Math.abs(r.epsEstimated)) * 100 : null), fmt: (v) => pctRaw(v), cls: (v) => tone(v) },
              ]} /> : <div className="empty">No US companies report today.</div>}
            </Card>

            <div className="grid" style={{ gap: 16 }}>
              <Card title="Your watchlist — upcoming earnings">
                {we.loading ? <Loading h={60} /> : we.rows.map((r) => (
                  <Link key={r.symbol} to={`/c/${r.symbol}`} className="row" style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', color: 'inherit' }}>
                    <b className="mono" style={{ width: 60 }}>{r.symbol}</b>
                    {r.hasDate
                      ? <span className={r.date === todayIso ? 'chip blue' : 'muted'}>{r.date === todayIso ? 'TODAY' : dayName(r.date)}</span>
                      : <span className="sub">Next date not announced</span>}
                    <span className="spacer" />
                    {r.last && surprise(r.last) != null && <span className={`chip ${surprise(r.last) >= 0 ? 'pos' : 'neg'}`} title={`Reported ${r.last.date}`}>{surprise(r.last) >= 0 ? 'Beat' : 'Missed'} {shortDate(r.last.date).replace(/, \d{4}$/, '')}</span>}
                    {r.hasDate && <span className="sub">EPS est {num(r.epsEstimated)}</span>}
                  </Link>
                ))}
              </Card>
              {d.watchReported.length > 0 && (
                <Card title="Your watchlist — latest results">
                  {d.watchReported.map((r) => (
                    <Link key={r.symbol + r.date} to={`/c/${r.symbol}/earnings`} className="row" style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', color: 'inherit' }}>
                      <b className="mono" style={{ width: 60 }}>{r.symbol}</b><span className="sub">{shortDate(r.date)}</span><span className="spacer" />
                      <span className="mono">{num(r.epsActual)} vs {num(r.epsEstimated)}</span>
                      <span className={`chip ${r.epsSurprisePct > 0 ? 'pos' : 'neg'}`}>{r.epsSurprisePct > 0 ? 'Beat' : 'Miss'} {pctRaw(r.epsSurprisePct)}</span>
                    </Link>
                  ))}
                </Card>
              )}
              <Card title="Watchlist moves">
                {d.quotes.map((q) => {
                  const ch = q.changePercentage ?? q.changesPercentage;
                  return (
                    <Link key={q.symbol} to={`/c/${q.symbol}`} className="row" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', color: 'inherit' }}>
                      <b className="mono" style={{ width: 60 }}>{q.symbol}</b><span className="muted" style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontSize: 13 }}>{q.name}</span>
                      <span className="mono">{price(q.price)}</span><span className={`mono ${tone(ch)}`} style={{ width: 64, textAlign: 'right' }}>{ch > 0 ? '+' : ''}{pctRaw(ch, 2)}</span>
                    </Link>
                  );
                })}
                {!d.quotes.length && <div className="empty">Add stocks to your watchlist.</div>}
              </Card>
            </div>
          </div>

          <Card title="Watchlist news">
            {d.news.slice(0, 25).map((n, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span className="chip mono" style={{ marginRight: 8 }}>{n.symbol}</span>
                <a href={n.url} target="_blank" rel="noreferrer">{n.title}</a>
                <div className="sub">{shortDate(n.publishedDate)} · {n.publisher || n.site}</div>
              </div>
            ))}
            {!d.news.length && <div className="empty">No recent news.</div>}
          </Card>
        </>
      )}
    </div>
  );
}
