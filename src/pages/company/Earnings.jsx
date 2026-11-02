import { useEffect, useMemo, useState } from 'react';
import { Card, DataTable, Loading, Markdown, Spinner, Err } from '../../components/ui.jsx';
import { MetricChart } from '../../components/charts.jsx';
import { fmp, fmpSafe } from '../../lib/api.js';
import { pick } from '../../lib/company.js';
import { streamAI, loadAI, saveAI, transcriptPrompt, SYSTEM } from '../../lib/ai.js';
import { money, num, shortDate, isNum, pctRaw } from '../../lib/format.js';

export async function getLatestTranscript(symbol) {
  const { data } = await fmpSafe('earning-call-transcript-dates', { symbol });
  const d = Array.isArray(data) ? [...data].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] : null;
  if (!d) return null;
  const t = await fmp('earning-call-transcript', { symbol, year: d.fiscalYear ?? d.year, quarter: d.quarter });
  const row = Array.isArray(t) ? t[0] : null;
  return row ? { ...row, label: `Q${d.quarter} FY${d.fiscalYear ?? d.year}` } : null;
}

export function LatestReport({ m, compact }) {
  const r = m.lastReport;
  if (!r) return null;
  const beat = (v) => (v == null ? null : v >= 0 ? <span className="chip pos">Beat {pctRaw(v * 100)}</span> : <span className="chip neg">Missed {pctRaw(v * 100)}</span>);
  return (
    <Card title={`Latest earnings: ${r.label}`} sub={`Announced ${shortDate(r.date)}${m.nextEarnings ? ` · next report ${shortDate(m.nextEarnings)}` : ''}`}>
      <div className="stats">
        <div className="stat"><div className="l">EPS (actual vs est.)</div><div className="v">{num(r.epsActual)}</div><div className="s">est {num(r.epsEstimated)} {beat(r.epsSurprise)}</div></div>
        <div className="stat"><div className="l">Revenue (actual vs est.)</div><div className="v">{money(r.revActual)}</div><div className="s">est {money(r.revEstimated)} {beat(r.revSurprise)}</div></div>
        {!compact && <div className="stat"><div className="l">Revenue growth (YoY)</div><div className={`v ${r.revYoY > 0 ? 'pos' : r.revYoY < 0 ? 'neg' : ''}`}>{r.revYoY == null ? '—' : pctRaw(r.revYoY * 100)}</div><div className="s">vs same quarter last year</div></div>}
        {!compact && <div className="stat"><div className="l">EPS growth (YoY)</div><div className={`v ${r.epsYoY > 0 ? 'pos' : r.epsYoY < 0 ? 'neg' : ''}`}>{r.epsYoY == null ? '—' : pctRaw(r.epsYoY * 100)}</div></div>}
        {!compact && <div className="stat"><div className="l">Gross / Op / Net margin</div><div className="v" style={{ fontSize: 15 }}>{r.grossMargin == null ? '—' : `${pctRaw(r.grossMargin * 100, 0)} / ${pctRaw(r.opMargin * 100, 0)} / ${pctRaw(r.netMargin * 100, 0)}`}</div><div className="s">that quarter</div></div>}
      </div>
      {r.statementsPending && <div className="sub" style={{ marginTop: 8 }}>The full financial statements for {r.label} haven't been filed into the data feed yet. Growth and margins fill in once they are (usually within a few weeks of the announcement).</div>}
    </Card>
  );
}

export default function Earnings({ c, m }) {
  const [dates, setDates] = useState(null);
  const [dateErr, setDateErr] = useState('');
  const [sel, setSel] = useState(null);
  const [tr, setTr] = useState(null);
  const [trErr, setTrErr] = useState('');
  const [find, setFind] = useState('');
  const [ai, setAi] = useState(null);
  const [busy, setBusy] = useState(false);
  const [aiErr, setAiErr] = useState('');

  const hist = c.earnings.map((e) => {
    const act = pick(e, 'epsActual', 'eps'), est = e.epsEstimated;
    return {
      ...e, act, est, surprise: isNum(act) && isNum(est) && est ? ((act - est) / Math.abs(est)) * 100 : null,
      revSurprise: isNum(e.revenueActual) && e.revenueEstimated ? ((e.revenueActual - e.revenueEstimated) / e.revenueEstimated) * 100 : null,
    };
  }).reverse();

  useEffect(() => {
    fmpSafe('earning-call-transcript-dates', { symbol: c.symbol }).then(({ data, error }) => {
      if (error) setDateErr(error);
      const list = (Array.isArray(data) ? data : []).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      setDates(list);
      if (list[0]) setSel(list[0]);
    });
  }, [c.symbol]);

  const key = sel ? `tr-${sel.fiscalYear ?? sel.year}-Q${sel.quarter}` : null;
  useEffect(() => {
    if (!sel) return;
    setTr(null); setTrErr(''); setAi(loadAI(c.symbol, key));
    fmp('earning-call-transcript', { symbol: c.symbol, year: sel.fiscalYear ?? sel.year, quarter: sel.quarter })
      .then((d) => { const r = Array.isArray(d) ? d[0] : null; if (r) setTr({ ...r, label: `Q${sel.quarter} FY${sel.fiscalYear ?? sel.year}` }); else setTrErr('Transcript not available.'); })
      .catch((e) => setTrErr(e.message));
  }, [sel?.date, c.symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const html = useMemo(() => {
    if (!tr) return '';
    let s = tr.content.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    s = s.replace(/^([A-Z][\w .'-]{1,40}):/gm, '<b>$1:</b>');
    if (find.trim().length > 1) {
      const re = new RegExp(`(${find.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      s = s.replace(re, '<mark>$1</mark>');
    }
    return s;
  }, [tr, find]);
  const hits = find.trim().length > 1 && tr ? (tr.content.match(new RegExp(find.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length : 0;

  const analyze = async () => {
    setBusy(true); setAiErr('');
    try {
      const text = await streamAI({ system: SYSTEM, prompt: transcriptPrompt(c, tr), maxTokens: 4000 }, (t) => setAi({ text: t, at: new Date().toISOString() }));
      saveAI(c.symbol, key, text);
    } catch (e) { setAiErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <LatestReport m={m} />
      <div className="grid g2">
        <Card title="EPS: actual vs estimate" sub={`Beat ${m.beats} of last ${m.reportedCount} quarters`}>
          <MetricChart data={[...hist].reverse().filter((h) => isNum(h.act)).slice(-12)} x="date" series={[{ key: 'est', name: 'Estimate', type: 'bar' }, { key: 'act', name: 'Actual', type: 'bar' }]} kind="price" />
        </Card>
        <Card title="Earnings history">
          <DataTable maxHeight={280} rows={hist} cols={[
            { key: 'date', label: 'Date', txt: true, fmt: (v, r) => <>{v}{!isNum(r.act) && <span className="chip blue" style={{ marginLeft: 6 }}>upcoming</span>}</> },
            { key: 'act', label: 'EPS', fmt: (v) => num(v) }, { key: 'est', label: 'EPS est', fmt: (v) => num(v) },
            { key: 'surprise', label: 'Surprise', fmt: (v) => pctRaw(v), cls: (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '') },
            { key: 'revenueActual', label: 'Revenue', fmt: money }, { key: 'revenueEstimated', label: 'Rev est', fmt: money },
            { key: 'revSurprise', label: 'Rev surp.', fmt: (v) => pctRaw(v), cls: (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '') },
          ]} />
        </Card>
      </div>

      <Card title="Earnings call transcripts" right={dates?.length ? (
        <select value={sel?.date || ''} onChange={(e) => setSel(dates.find((d) => d.date === e.target.value))}>
          {dates.map((d) => <option key={d.date} value={d.date}>Q{d.quarter} FY{d.fiscalYear ?? d.year} — {shortDate(d.date)}</option>)}
        </select>) : null}>
        {!dates ? <Loading /> : !dates.length ? <Err>{dateErr ? `Transcripts unavailable: ${dateErr}. Earnings transcripts require an FMP Starter plan or higher.` : 'No transcripts found.'}</Err> : null}
        {sel && (
          <div className="grid g2" style={{ gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr)', alignItems: 'start' }}>
            <div>
              <div className="row" style={{ marginBottom: 10 }}>
                <b>AI call analysis — guidance, growth, management tone</b><span className="spacer" />
                <button className="btn primary" onClick={analyze} disabled={busy || !tr}>{busy ? <><Spinner /> Analyzing…</> : ai ? 'Re-analyze' : 'Analyze call'}</button>
              </div>
              <Err>{aiErr}</Err>
              {ai ? <><div className="sub">Generated {shortDate(ai.at)}</div><Markdown text={ai.text} /></> : <div className="empty">Analyze this call to extract guidance, growth drivers, margin commentary, management tone and Q&A highlights.</div>}
            </div>
            <div>
              <div className="row" style={{ marginBottom: 10 }}>
                <input placeholder="Search transcript (e.g. guidance, pricing, AI)…" value={find} onChange={(e) => setFind(e.target.value)} style={{ flex: 1 }} />
                {hits > 0 && <span className="chip blue">{hits} hits</span>}
              </div>
              {trErr ? <Err>{trErr}</Err> : !tr ? <Loading /> : <div className="transcript card-b" style={{ border: '1px solid var(--border)', borderRadius: 8 }} dangerouslySetInnerHTML={{ __html: html }} />}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
