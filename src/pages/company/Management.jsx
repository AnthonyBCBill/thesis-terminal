import { useEffect, useState } from 'react';
import { Card, DataTable, Loading, Markdown, Spinner, Err } from '../../components/ui.jsx';
import { fmpSafe } from '../../lib/api.js';
import { streamAI, loadAI, saveAI, managementPrompt, SYSTEM } from '../../lib/ai.js';
import { money, int, shortDate, isNum } from '../../lib/format.js';

const MGMT_WORDS = /\b(ceo|cfo|coo|cto|chief|president|chair|appoint|resign|steps? down|retire|succeed|hire|names? new|depart|board)\b/i;

export default function Management({ c }) {
  const [d, setD] = useState(null);
  const [ai, setAi] = useState(() => loadAI(c.symbol, 'mgmt'));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const [ex, comp, ins, news, pr] = await Promise.all([
        fmpSafe('key-executives', { symbol: c.symbol }),
        fmpSafe('governance-executive-compensation', { symbol: c.symbol }),
        fmpSafe('insider-trading/search', { symbol: c.symbol, page: 0, limit: 60 }),
        fmpSafe('news/stock', { symbols: c.symbol, limit: 50 }),
        fmpSafe('news/press-releases', { symbols: c.symbol, limit: 30 }),
      ]);
      const allNews = [...(Array.isArray(pr.data) ? pr.data.map((n) => ({ ...n, pr: true })) : []), ...(Array.isArray(news.data) ? news.data : [])]
        .sort((a, b) => String(b.publishedDate).localeCompare(String(a.publishedDate)));
      setD({
        execs: Array.isArray(ex.data) ? ex.data : [], comp: Array.isArray(comp.data) ? comp.data : [],
        insider: Array.isArray(ins.data) ? ins.data : [], news: allNews,
        errors: [ex.error, comp.error, ins.error, news.error].filter(Boolean),
      });
    })();
  }, [c.symbol]);

  const run = async () => {
    setBusy(true); setErr('');
    try {
      const text = await streamAI({ system: SYSTEM, prompt: managementPrompt(c, d.execs, d.comp, d.insider, d.news), maxTokens: 3000 }, (t) => setAi({ text: t, at: new Date().toISOString() }));
      saveAI(c.symbol, 'mgmt', text);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  if (!d) return <Loading label="Loading management data…" />;
  const mgmtNews = d.news.filter((n) => MGMT_WORDS.test(n.title || ''));
  const buys = d.insider.filter((i) => /^P/.test(i.transactionType || '')), sells = d.insider.filter((i) => /^S/.test(i.transactionType || ''));
  const latestComp = (() => {
    if (!d.comp.length) return [];
    const yr = Math.max(...d.comp.map((r) => +r.year || 0));
    return d.comp.filter((r) => +r.year === yr).sort((a, b) => (b.total || 0) - (a.total || 0));
  })();

  return (
    <div className="grid" style={{ gap: 16 }}>
      {mgmtNews.length > 0 && (
        <Card title="Management updates" sub="Headlines mentioning leadership changes, appointments or departures">
          {mgmtNews.slice(0, 8).map((n, i) => (
            <div key={i} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <a href={n.url} target="_blank" rel="noreferrer"><b>{n.title}</b></a>
              <div className="sub">{shortDate(n.publishedDate)} · {n.publisher || n.site}{n.pr ? ' · Press release' : ''}</div>
            </div>
          ))}
        </Card>
      )}
      <div className="grid g2">
        <Card title="Key executives">
          {d.execs.length ? <DataTable rows={d.execs} cols={[
            { key: 'name', label: 'Name', txt: true }, { key: 'title', label: 'Title', txt: true, fmt: (v) => <span style={{ whiteSpace: 'normal' }}>{v}</span> },
            { key: 'titleSince', label: 'Since', fmt: (v) => (v ? String(v).slice(0, 4) : '—') },
            { key: 'yearBorn', label: 'Age', fmt: (v) => (v ? new Date().getFullYear() - v : '—') },
            { key: 'pay', label: 'Pay', fmt: money },
          ]} /> : <div className="empty">No executive data</div>}
        </Card>
        <Card title={`Executive compensation${latestComp[0] ? ` (${latestComp[0].year})` : ''}`}>
          {latestComp.length ? <DataTable rows={latestComp} cols={[
            { key: 'nameAndPosition', label: 'Executive', txt: true, fmt: (v) => <span style={{ whiteSpace: 'normal', fontSize: 12 }}>{v}</span> },
            { key: 'salary', label: 'Salary', fmt: money }, { key: 'stockAward', label: 'Stock', fmt: money },
            { key: 'incentivePlanCompensation', label: 'Bonus/incentive', fmt: money }, { key: 'total', label: 'Total', fmt: money },
          ]} /> : <div className="empty">Not available on your data plan</div>}
        </Card>
      </div>

      <Card title="Insider transactions" sub={`Last ${d.insider.length}: ${buys.length} buys · ${sells.length} sells. Open-market buys (P) are the strongest signal.`}>
        {d.insider.length ? <DataTable maxHeight={420} rows={d.insider} cols={[
          { key: 'transactionDate', label: 'Date', txt: true }, { key: 'reportingName', label: 'Insider', txt: true },
          { key: 'typeOfOwner', label: 'Role', txt: true, fmt: (v) => <span style={{ fontSize: 12 }}>{v}</span> },
          { key: 'transactionType', label: 'Type', txt: true, cls: (v) => (/^P/.test(v || '') ? 'pos' : /^S/.test(v || '') ? 'neg' : '') },
          { key: 'securitiesTransacted', label: 'Shares', fmt: int }, { key: 'price', label: 'Price', fmt: (v) => (isNum(v) && v ? `$${v.toFixed(2)}` : '—') },
          { key: 'value', label: 'Value', get: (r) => (r.securitiesTransacted || 0) * (r.price || 0), fmt: (v) => (v ? money(v) : '—') },
        ]} /> : <div className="empty">No insider data</div>}
      </Card>

      <Card title="AI management assessment" sub="Talent, experience, track record, incentives, leadership changes" right={
        <button className="btn primary" onClick={run} disabled={busy}>{busy ? <><Spinner /> Analyzing…</> : ai ? 'Refresh' : 'Assess management'}</button>}>
        <Err>{err}</Err>
        {ai ? <><div className="sub">Generated {shortDate(ai.at)}</div><Markdown text={ai.text} /></> : <div className="empty">Click "Assess management" for an AI review of the team.</div>}
      </Card>

      <Card title="Recent news & press releases">
        {d.news.slice(0, 30).map((n, i) => (
          <div key={i} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
            <a href={n.url} target="_blank" rel="noreferrer">{n.title}</a>
            <div className="sub">{shortDate(n.publishedDate)} · {n.publisher || n.site}{n.pr ? ' · Press release' : ''}</div>
          </div>
        ))}
        {!d.news.length && <div className="empty">No news</div>}
      </Card>
    </div>
  );
}
