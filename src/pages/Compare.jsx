import { Fragment, useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { loadPeers, peerRow, peerAverages } from '../lib/company.js';
import { streamAI, comparePrompt, SYSTEM } from '../lib/ai.js';
import { exportRows, PEER_COLS } from '../lib/excel.js';
import { Card, Loading, Markdown, Spinner, Err } from '../components/ui.jsx';
import TickerSearch from '../components/TickerSearch.jsx';
import { MetricChart, Lines } from '../components/charts.jsx';
import { money, pct, mult, num, signPct, price, isNum, lev } from '../lib/format.js';

// Metrics down, companies across — like a comp sheet in Excel.
const SECTIONS = [
  ['Valuation', [['price', 'Price', price], ['marketCap', 'Market cap', money], ['trailingPE', 'Trailing P/E', mult, 'low'], ['forwardPE', 'Forward P/E', mult, 'low'],
    ['forwardPE2', 'FY+2 P/E', mult, 'low'], ['peg', 'PEG', num, 'low'], ['evEbitda', 'EV/EBITDA', mult, 'low'], ['ps', 'P/S', mult, 'low'], ['pfcf', 'P/FCF', mult, 'low'], ['fcfYield', 'FCF yield', pct, 'high']]],
  ['Growth (consensus)', [['revGrowthNext', 'Revenue growth next FY', signPct, 'high'], ['epsGrowthNext', 'EPS growth next FY', signPct, 'high']]],
  ['Profitability (TTM)', [['revenue', 'Revenue', money], ['gross', 'Gross margin', pct, 'high'], ['operating', 'Operating margin', pct, 'high'], ['net', 'Net margin', pct, 'high'], ['fcfMargin', 'FCF margin', pct, 'high'], ['roic', 'ROIC', pct, 'high']]],
  ['Balance sheet', [['netDebt', 'Net debt', money, 'low'], ['netDebtToEbitda', 'Net debt / EBITDA', lev], ['interestCoverage', 'Interest coverage', mult, 'high']]],
  ['Spend', [['marketingPct', 'Sales & marketing % rev', pct], ['rndPct', 'R&D % rev', pct]]],
];

export default function Compare() {
  const [sp, setSp] = useSearchParams();
  const syms = (sp.get('s') || 'AAPL,MSFT,GOOGL').split(',').filter(Boolean).slice(0, 8);
  const [cos, setCos] = useState(null);
  const [ai, setAi] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const setSyms = (l) => setSp({ s: l.join(',') });

  useEffect(() => { setCos(null); setAi(''); loadPeers(syms).then(setCos); }, [syms.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = (cos || []).map(peerRow);
  const avgs = rows.length > 1 ? peerAverages(rows) : null;

  const best = (key, dir) => {
    const v = rows.map((r) => r[key]).filter((x) => isNum(x) && !(key.includes('PE') && x <= 0));
    if (!v.length || !dir) return null;
    return dir === 'low' ? Math.min(...v) : Math.max(...v);
  };
  const runAI = async () => {
    setBusy(true); setErr('');
    try { await streamAI({ system: SYSTEM, prompt: comparePrompt(rows), maxTokens: 3500 }, setAi); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  // Revenue history across companies
  const revHist = (() => {
    if (!cos) return [];
    const years = [...new Set(cos.flatMap((c) => c.m.history.map((h) => h.year)))].sort().slice(-6);
    return years.map((y) => Object.fromEntries([['year', y], ...cos.map((c) => [c.symbol, c.m.history.find((h) => h.year === y)?.operating ?? null])]));
  })();

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="row"><h1>Compare</h1><span className="spacer" />
        {rows.length > 0 && <button className="btn sm" onClick={() => exportRows(avgs ? [...rows, { symbol: 'AVG', ...avgs.avg }] : rows, PEER_COLS, `compare_${syms.join('_')}`)}>Export to Excel</button>}
      </div>
      <Card>
        <div className="row">
          {syms.map((s) => <span key={s} className="chip mono">{s}<button onClick={() => setSyms(syms.filter((x) => x !== s))} style={{ border: 0, background: 'none', color: 'var(--text-3)', padding: 0, marginLeft: 2 }}>×</button></span>)}
          <div style={{ width: 280 }}><TickerSearch onPick={(s) => !syms.includes(s) && setSyms([...syms, s])} placeholder="Add a company (up to 8)…" /></div>
        </div>
      </Card>
      {!cos ? <Loading label="Loading companies…" h={200} /> : (
        <>
          <Card title="Side-by-side" sub="Green = best in group">
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th style={{ textAlign: 'left' }}>Metric</th>{rows.map((r) => <th key={r.symbol}><Link to={`/c/${r.symbol}`}>{r.symbol}</Link></th>)}{avgs && <th>Average</th>}</tr></thead>
                <tbody>
                  {SECTIONS.map(([title, items]) => (
                    <Fragment key={title}>
                      <tr className="avg"><td colSpan={rows.length + 2}>{title}</td></tr>
                      {items.map(([k, label, f, dir]) => {
                        const b = best(k, dir);
                        return (
                          <tr key={k}><td>{label}</td>
                            {rows.map((r) => <td key={r.symbol} className={isNum(b) && r[k] === b && rows.length > 1 ? 'pos' : ''} style={isNum(b) && r[k] === b ? { fontWeight: 600 } : null}>{f(r[k])}</td>)}
                            {avgs && <td className="muted">{avgs.avg[k] !== undefined ? f(avgs.avg[k]) : ''}</td>}
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="grid g2">
            <Card title="Trailing vs forward P/E"><MetricChart data={rows} x="symbol" series={[{ key: 'trailingPE', name: 'Trailing', type: 'bar' }, { key: 'forwardPE', name: 'Forward', type: 'bar' }]} kind="mult" /></Card>
            <Card title="Margins (TTM)"><MetricChart data={rows} x="symbol" series={[{ key: 'gross', name: 'Gross', type: 'bar' }, { key: 'operating', name: 'Operating', type: 'bar' }, { key: 'net', name: 'Net', type: 'bar' }]} kind="pct" /></Card>
            <Card title="Growth expectations (next FY)"><MetricChart data={rows} x="symbol" series={[{ key: 'revGrowthNext', name: 'Revenue', type: 'bar' }, { key: 'epsGrowthNext', name: 'EPS', type: 'bar' }]} kind="pct" /></Card>
            <Card title="Operating margin history"><Lines data={revHist} keys={cos.map((c) => c.symbol)} /></Card>
          </div>
          <Card title="AI head-to-head" right={<button className="btn primary" onClick={runAI} disabled={busy}>{busy ? <><Spinner /> Comparing…</> : 'Compare with AI'}</button>}>
            <Err>{err}</Err>
            {ai ? <Markdown text={ai} /> : <div className="empty">Get a ranked risk/reward comparison of these companies.</div>}
          </Card>
        </>
      )}
    </div>
  );
}
