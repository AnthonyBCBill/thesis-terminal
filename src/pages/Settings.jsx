import { useState } from 'react';
import { Card, Spinner } from '../components/ui.jsx';
import { getAppKey, setAppKey, clearCache, api, isEco, setEco, usageToday, unavailableList, resetUnavailable } from '../lib/api.js';
import { useUserData } from '../lib/userdata.jsx';

export default function Settings({ theme, flip }) {
  const [key, setKey] = useState(getAppKey());
  const [checks, setChecks] = useState(null);
  const [busy, setBusy] = useState(false);
  const { synced } = useUserData();

  const test = async () => {
    setBusy(true);
    const out = {};
    const h = { 'x-app-key': getAppKey() };
    try { const r = await fetch('/api/fmp/quote?symbol=AAPL', { headers: h }); const d = await r.json(); out.fmp = r.ok && Array.isArray(d) && d[0]?.price ? `OK — AAPL $${d[0].price}` : `Failed: ${d.error || d['Error Message'] || r.status}`; } catch (e) { out.fmp = `Failed: ${e.message}`; }
    try { const r = await fetch('/api/fmp/earning-call-transcript-dates?symbol=AAPL', { headers: h }); const d = await r.json(); out.tr = r.ok && Array.isArray(d) && d.length ? `OK — ${d.length} AAPL calls available` : `Not available: ${d.error || d['Error Message'] || 'your FMP plan may not include transcripts'}`; } catch (e) { out.tr = `Failed: ${e.message}`; }
    try { await api('/api/userdata'); out.store = 'OK'; } catch (e) { out.store = `Failed: ${e.message}`; }
    try {
      const r = await fetch('/api/ai', { method: 'POST', headers: { ...h, 'content-type': 'application/json' }, body: JSON.stringify({ system: 'Reply with OK.', prompt: 'Say OK', maxTokens: 5 }) });
      out.ai = r.ok && (await r.text()).includes("content_block") ? "OK — Claude is responding" : `Failed: ${(await r.json().catch(() => ({}))).error || r.status}`;
    } catch (e) { out.ai = `Failed: ${e.message}`; }
    setChecks(out); setBusy(false);
  };

  const Row = ({ label, v }) => <div className="row" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}><span style={{ width: 210 }} className="muted">{label}</span><span className={String(v).startsWith('OK') ? 'pos' : 'neg'}>{v}</span></div>;

  return (
    <div className="grid" style={{ gap: 16, maxWidth: 860 }}>
      <h1>Settings</h1>
      <Card title="App password" sub="Must match APP_PASSWORD in Netlify. Stored only on this device.">
        <div className="row">
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="App password" style={{ flex: 1 }} />
          <button className="btn primary" onClick={() => { setAppKey(key); clearCache(); window.location.reload(); }}>Save</button>
        </div>
      </Card>
      <Card title="Connection check" right={<button className="btn" onClick={test} disabled={busy}>{busy && <Spinner />}Run check</button>}>
        {checks ? <>
          <Row label="Market data (FMP)" v={checks.fmp} />
          <Row label="Earnings transcripts" v={checks.tr} />
          <Row label="Saved data (watchlist, notes)" v={checks.store} />
          <Row label="AI analysis (Claude)" v={checks.ai} />
        </> : <div className="sub">Checks your Netlify environment variables. Sync status: {synced}.</div>}
      </Card>
      <Card title="Free-plan economy mode" sub="FMP's free plan allows about 250 requests a day.">
        <div className="row" style={{ marginBottom: 10 }}>
          <label className="row" style={{ gap: 6 }}><input type="checkbox" defaultChecked={isEco()} onChange={(e) => setEco(e.target.checked)} /> Economy mode (recommended on the free plan)</label>
        </div>
        <div className="md">
          <ul>
            <li>Requests from this device today: <b>{usageToday()}</b> of ~250</li>
            <li>A company page costs about 17 requests; competitors load only on Valuation, Margins, Debt, Competition and Memo tabs (max 5, ~6 requests each).</li>
            <li>Data is cached for 24 hours, so reopening a company is free.</li>
            <li>Skipped because your plan doesn't include them: <b>{unavailableList().join(', ') || 'none yet'}</b> {unavailableList().length > 0 && <button className="btn sm" onClick={() => { resetUnavailable(); window.location.reload(); }}>Retry these (after upgrading)</button>}</li>
          </ul>
        </div>
      </Card>
      <Card title="Display & data">
        <div className="row">
          <button className="btn" onClick={flip}>Switch to {theme === 'dark' ? 'light' : 'dark'} mode</button>
          <button className="btn" onClick={() => { clearCache(); alert('Cached market data cleared.'); }}>Clear cached data</button>
        </div>
      </Card>
      <Card title="Daily earnings alerts">
        <div className="md">
          <p>Every weekday at 7:00 AM Eastern (6:00 AM during daylight saving time), Thesis builds your briefing: who reports today (largest first), your watchlist's upcoming earnings, your watchlist's latest results, price moves and news. To receive it:</p>
          <ul>
            <li><b>Phone push (free):</b> install the <b>ntfy</b> app, subscribe to a private topic name (e.g. <code>thesis-ant-7731</code>), and set <code>NTFY_TOPIC</code> in Netlify to the same name.</li>
            <li><b>Email:</b> create a free Resend account, set <code>RESEND_API_KEY</code> and <code>ALERT_EMAIL</code> in Netlify.</li>
          </ul>
          <p>Use "Send me today's alert" on the Briefing page to test.</p>
        </div>
      </Card>
      <Card title="Netlify environment variables">
        <div className="md">
          <table><thead><tr><th>Variable</th><th>Required</th><th>What it does</th></tr></thead><tbody>
            <tr><td><code>FMP_API_KEY</code></td><td>Yes</td><td>Financial Modeling Prep key — all market data. Starter plan or higher for transcripts.</td></tr>
            <tr><td><code>ANTHROPIC_API_KEY</code></td><td>Yes</td><td>Claude — research memos, transcript analysis, management review.</td></tr>
            <tr><td><code>APP_PASSWORD</code></td><td>Recommended</td><td>Locks the app so only you can use your API keys.</td></tr>
            <tr><td><code>ANTHROPIC_MODEL</code></td><td>No</td><td>Defaults to claude-sonnet-5-5.</td></tr>
            <tr><td><code>NTFY_TOPIC</code></td><td>No</td><td>Daily push notification to your phone.</td></tr>
            <tr><td><code>RESEND_API_KEY</code>, <code>ALERT_EMAIL</code></td><td>No</td><td>Daily email briefing.</td></tr>
          </tbody></table>
        </div>
      </Card>
    </div>
  );
}
