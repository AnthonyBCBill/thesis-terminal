import { useState } from 'react';
import { Card, Spinner, Err } from '../../components/ui.jsx';
import { streamAI, loadAI, saveAI, gradePrompt, parseGrade, SYSTEM, CRITERIA } from '../../lib/ai.js';
import { getLatestTranscript } from './Earnings.jsx';
import { price, shortDate, signPct, isNum } from '../../lib/format.js';

// Colors per letter: S purple, A green, B teal, C blue-grey, D orange, F red.
export function gradeColor(g = '') {
  const L = g[0];
  return { S: '#7c3aed', A: '#0f9d58', B: '#14b8a6', C: '#64748b', D: '#ea7a0c', F: '#d93025' }[L] || '#64748b';
}

export function GradeBadge({ grade, size = 64 }) {
  if (!grade) return <span className="sub">—</span>;
  const c = gradeColor(grade);
  return (
    <span style={{
      display: 'inline-grid', placeItems: 'center', width: size, height: size, borderRadius: size * 0.22,
      background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c, border: `1.5px solid ${c}`,
      fontWeight: 700, fontSize: size * 0.42, fontFamily: 'Inter, sans-serif', letterSpacing: '-0.03em',
    }}>{grade}</span>
  );
}

const MEANING = { S: 'Extremely undervalued', A: 'Very undervalued', B: 'Somewhat undervalued', C: 'Properly valued', D: 'Overvalued', F: 'Nearing bankruptcy' };

export default function Grade({ c, m, peerRows, avgs, peerLoading }) {
  const [saved, setSaved] = useState(() => loadAI(c.symbol, 'grade'));
  const [stream, setStream] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const g = parseGrade(saved?.text);
  const stale = saved && m.lastReport && saved.basedOn && m.lastReport.date > saved.basedOn;

  const run = async () => {
    setBusy(true); setErr(''); setStream('');
    let transcript = null;
    setStatus('Checking for the latest earnings call transcript…');
    try { transcript = await getLatestTranscript(c.symbol); } catch { /* not on plan */ }
    setStatus(`Grading ${c.symbol} on ${m.lastReport ? `${m.lastReport.label} earnings (${m.lastReport.date})` : 'latest data'}…`);
    try {
      const text = await streamAI({ system: SYSTEM, prompt: gradePrompt(c, peerRows, avgs, transcript?.content), maxTokens: 6000 }, setStream);
      if (!parseGrade(text)) throw new Error('The AI response could not be read — please try again.');
      const meta = { basedOn: m.lastReport?.date || null, quarter: m.lastReport?.label || null, price: m.price };
      saveAI(c.symbol, 'grade', text, meta);
      setSaved({ text, at: new Date().toISOString(), ...meta });
    } catch (e) { setErr(e.message); }
    setBusy(false); setStatus(''); setStream('');
  };

  const button = (
    <button className="btn primary" onClick={run} disabled={busy || peerLoading}>
      {busy ? <><Spinner /> Grading…</> : peerLoading ? 'Loading peers…' : g ? 'Re-grade' : 'Generate AI grade'}
    </button>
  );

  if (!g) {
    return (
      <Card title="AI Grade" sub="A growth-adjusted grade from S to F, built on your checklist and the company's most recent earnings." right={button}>
        <Err>{err}</Err>
        {status && <div className="info-box" style={{ marginBottom: 10 }}><Spinner /> {status} {stream && <span className="sub">({Math.round(stream.length / 100) / 10}k characters)</span>}</div>}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
          {Object.entries(MEANING).map(([k, v]) => (
            <div key={k} className="row" style={{ gap: 10 }}><GradeBadge grade={k} size={34} /><span className="muted" style={{ fontSize: 13 }}>{v}</span></div>
          ))}
        </div>
        <p className="sub" style={{ marginTop: 12 }}>Plus and minus (e.g. B+, B-) separate grades within a band. Growth is built into the grade, so a fast grower on a high P/E isn't marked down on the P/E alone.</p>
      </Card>
    );
  }

  const groups = CRITERIA.map(([name, items]) => ({
    name,
    rows: items.map((it) => g.criteria?.find((x) => x.item?.toLowerCase().trim() === it.toLowerCase()) || g.criteria?.find((x) => x.item?.toLowerCase().includes(it.toLowerCase().slice(0, 18))) || { item: it, grade: null, finding: '—' }),
  }));
  const fv = g.fairValue || {};
  const upside = isNum(fv.mid) && m.price ? fv.mid / m.price - 1 : null;

  return (
    <div className="grid" style={{ gap: 16 }}>
      {stale && <div className="note-box">{c.symbol} has reported new earnings ({m.lastReport.label}, {m.lastReport.date}) since this grade was made. Click <b>Re-grade</b> to update it.</div>}
      <Err>{err}</Err>
      {status && <div className="info-box"><Spinner /> {status}</div>}
      <Card>
        <div className="row" style={{ gap: 20, alignItems: 'flex-start' }}>
          <GradeBadge grade={g.overall} size={96} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="row" style={{ gap: 8 }}>
              <h2 style={{ margin: 0 }}>{g.label || MEANING[g.overall?.[0]]}</h2>
              {isNum(g.score) && <span className="chip">{g.score}/100</span>}
            </div>
            <div style={{ fontSize: 15, margin: '6px 0' }}>{g.oneLiner}</div>
            <div className="sub">
              Based on {saved.quarter ? <b>{saved.quarter} earnings ({saved.basedOn})</b> : 'the latest data'} · graded {shortDate(saved.at)} at {price(saved.price)}
            </div>
          </div>
          {button}
        </div>
      </Card>

      <div className="grid g3">
        <Card title="Why this grade"><p style={{ margin: 0, lineHeight: 1.6 }}>{g.summary}</p></Card>
        <Card title="Growth adjustment"><p style={{ margin: 0, lineHeight: 1.6 }}>{g.growthAdjustment}</p></Card>
        <Card title="Fair value estimate" sub={fv.method}>
          <div className="row" style={{ justifyContent: 'space-between', textAlign: 'center' }}>
            <div><div className="sub">Low</div><div className="mono" style={{ fontSize: 17 }}>{price(fv.low)}</div></div>
            <div><div className="sub">Mid</div><div className="mono" style={{ fontSize: 22, fontWeight: 600 }}>{price(fv.mid)}</div></div>
            <div><div className="sub">High</div><div className="mono" style={{ fontSize: 17 }}>{price(fv.high)}</div></div>
          </div>
          {upside != null && <div style={{ marginTop: 10, textAlign: 'center' }} className={upside >= 0 ? 'pos' : 'neg'}>{signPct(upside)} vs today's {price(m.price)}</div>}
        </Card>
      </div>

      {g.latestEarnings && (
        <Card title={`Most recent earnings: ${g.latestEarnings.quarter || saved.quarter || ''}`} sub={g.latestEarnings.date || saved.basedOn}>
          <div style={{ fontWeight: 500, marginBottom: 6 }}>{g.latestEarnings.verdict}</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{(g.latestEarnings.highlights || []).map((h, i) => <li key={i}>{h}</li>)}</ul>
        </Card>
      )}

      <Card title="Checklist grades" sub="Each item from your research list. Letters here grade quality: S = exceptional, C = average, F = very poor.">
        {groups.map((grp) => (
          <div key={grp.name} style={{ marginBottom: 6 }}>
            <div className="nav-sec" style={{ paddingLeft: 0 }}>{grp.name}</div>
            {grp.rows.map((r) => (
              <div key={r.item} className="check" style={{ gridTemplateColumns: '44px 1fr' }}>
                <GradeBadge grade={r.grade} size={34} />
                <div><div className="q">{r.item}</div><div className="a">{r.finding}</div></div>
              </div>
            ))}
          </div>
        ))}
      </Card>

      <div className="grid g3">
        <Card title="Bull case"><ul style={{ margin: 0, paddingLeft: 18 }}>{(g.bull || []).map((x, i) => <li key={i}>{x}</li>)}</ul></Card>
        <Card title="Bear case"><ul style={{ margin: 0, paddingLeft: 18 }}>{(g.bear || []).map((x, i) => <li key={i}>{x}</li>)}</ul></Card>
        <Card title="What would change the grade"><ul style={{ margin: 0, paddingLeft: 18 }}>{(g.whatWouldChangeTheGrade || []).map((x, i) => <li key={i}>{x}</li>)}</ul></Card>
      </div>
      <p className="sub">AI-generated opinion based on the data shown and the model's general knowledge; not investment advice.</p>
    </div>
  );
}
