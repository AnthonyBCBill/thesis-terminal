import { useEffect, useState } from 'react';
import { Card, Stat, DataTable, Loading } from '../../components/ui.jsx';
import { MetricChart } from '../../components/charts.jsx';
import { money, pct, mult, num, price, isNum, signPct } from '../../lib/format.js';
import { fmpSafe } from '../../lib/api.js';

export default function Valuation({ c, m, peerRows, avgs, peerLoading }) {
  const [industryPE, setIndustryPE] = useState(null);
  useEffect(() => {
    // Industry P/E snapshot (FMP). Try the last few trading days.
    (async () => {
      for (let i = 1; i <= 5; i++) {
        const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
        const { data } = await fmpSafe('industry-pe-snapshot', { date: d, exchange: c.profile.exchange || 'NASDAQ' });
        const hit = Array.isArray(data) && data.find((r) => r.industry === m.industry);
        if (hit) { setIndustryPE(Number(hit.pe)); return; }
        if (Array.isArray(data) && data.length) return;
      }
    })();
  }, [c.symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastA = m.history.at(-1) || {};
  const est = c.estimates.map((e, i, all) => {
    const prevRev = i ? all[i - 1].revenue : null, prevEps = i ? all[i - 1].eps : null;
    return { ...e, revGrowth: isNum(prevRev) && prevRev ? e.revenue / prevRev - 1 : null, epsGrowth: isNum(prevEps) && prevEps ? (e.eps - prevEps) / Math.abs(prevEps) : null, pe: e.eps > 0 ? m.price / e.eps : null, future: e.date > new Date().toISOString().slice(0, 10) };
  });

  const a = avgs?.avg || {};
  const implied = [
    { label: `Peer avg forward P/E (${mult(a.forwardPE)})`, v: isNum(a.forwardPE) && m.estNext ? a.forwardPE * m.estNext.eps : null },
    { label: `Own 5-yr avg P/E (${mult(m.pe5yAvg)})`, v: isNum(m.pe5yAvg) && m.estNext ? m.pe5yAvg * m.estNext.eps : null },
    { label: `Industry P/E (${mult(industryPE)})`, v: isNum(industryPE) && m.estNext ? industryPE * m.estNext.eps : null },
    { label: 'Analyst consensus target', v: m.targetPrice },
  ];

  const peChart = [...peerRows.map((p) => ({ symbol: p.symbol, trailing: p.trailingPE > 0 ? p.trailingPE : null, forward: p.forwardPE })),
    { symbol: c.symbol, trailing: m.trailingPE > 0 ? m.trailingPE : null, forward: m.forwardPE }]
    .sort((x, y) => (x.forward ?? 999) - (y.forward ?? 999));

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="stats">
        <Stat label="Trailing P/E" value={mult(m.trailingPE)} sub={`Peer avg ${mult(a.trailingPE)}`} />
        <Stat label="Forward P/E" value={mult(m.forwardPE)} sub={`Peer avg ${mult(a.forwardPE)}`} />
        <Stat label="FY+2 P/E" value={mult(m.forwardPE2)} sub={`Peer avg ${mult(a.forwardPE2)}`} />
        <Stat label="Industry P/E" value={mult(industryPE)} sub={m.industry} />
        <Stat label="PEG" value={num(m.peg)} sub={`Peer avg ${num(a.peg)}`} />
        <Stat label="EV/EBITDA" value={mult(m.evEbitda)} sub={`Peer avg ${mult(a.evEbitda)}`} />
        <Stat label="P/S" value={mult(m.ps)} sub={`Peer avg ${mult(a.ps)}`} />
        <Stat label="P/FCF" value={mult(m.pfcf)} sub={`FCF yield ${pct(m.fcfYield)}`} />
        <Stat label="P/B" value={mult(m.pb)} sub={`ROE ${pct(m.roe)}`} />
        <Stat label="5y / 10y avg P/E" value={`${mult(m.pe5yAvg, 0)} / ${mult(m.pe10yAvg, 0)}`} />
      </div>

      <div className="grid g2">
        <Card title="P/E history" sub="Year-end P/E; dashed line = 5-year average">
          <MetricChart data={m.peHistory} series={[{ key: 'pe', name: 'P/E', type: 'bar' }]} kind="mult" refY={m.pe5yAvg} />
        </Card>
        <Card title="Trailing vs forward P/E — peer group" sub={peerLoading ? 'Loading peers…' : 'Sorted by forward P/E'}>
          {peerLoading && !peerRows.length ? <Loading /> : <MetricChart data={peChart} x="symbol" series={[{ key: 'trailing', name: 'Trailing', type: 'bar' }, { key: 'forward', name: 'Forward', type: 'bar' }]} kind="mult" />}
        </Card>
      </div>

      <Card title="Guidance & growth — consensus estimates" sub="Analyst consensus by fiscal year. P/E column = today's price ÷ that year's EPS. Management's own guidance is in Earnings & Transcripts.">
        <DataTable rows={est} highlight={(r) => r.year === m.estNext?.year} cols={[
          { key: 'year', label: 'Fiscal year', fmt: (v, r) => <>FY{v} {!r.future && <span className="sub">(reported)</span>}</> },
          { key: 'revenue', label: 'Revenue est', fmt: money }, { key: 'revGrowth', label: 'Rev growth', fmt: signPct, cls: (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '') },
          { key: 'eps', label: 'EPS est', fmt: (v) => num(v) }, { key: 'epsGrowth', label: 'EPS growth', fmt: signPct, cls: (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '') },
          { key: 'epsLow', label: 'EPS low', fmt: (v) => num(v) }, { key: 'epsHigh', label: 'EPS high', fmt: (v) => num(v) },
          { key: 'pe', label: 'P/E on est', fmt: mult }, { key: 'ebitda', label: 'EBITDA est', fmt: money }, { key: 'analysts', label: '# analysts' },
        ]} />
        <div className="sub" style={{ marginTop: 8 }}>Last reported FY{lastA.year}: revenue {money(lastA.revenue)}, EPS {num(lastA.eps)}. Historical CAGR: revenue 3y {pct(m.revCagr3)} · 5y {pct(m.revCagr5)} · 10y {pct(m.revCagr10)}; EPS 5y {pct(m.epsCagr5)}.</div>
      </Card>

      <div className="grid g2">
        <Card title="Implied value per share (next-FY EPS × multiple)">
          {implied.map((r) => (
            <div key={r.label} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span className="muted">{r.label}</span><span className="spacer" />
              <b className="mono">{price(r.v)}</b>
              <span className={`mono ${r.v > m.price ? 'pos' : 'neg'}`} style={{ width: 70, textAlign: 'right' }}>{isNum(r.v) ? signPct(r.v / m.price - 1) : ''}</span>
            </div>
          ))}
        </Card>
        <Calculator m={m} />
      </div>
    </div>
  );
}

function Calculator({ m }) {
  const baseEps = m.estNext?.eps ?? m.ttm.eps;
  const [g, setG] = useState(() => Math.round(((m.epsGrowthNext2 ?? m.epsGrowthNext ?? 0.1) * 100)) || 10);
  const [pe, setPe] = useState(() => Math.round(m.pe5yAvg || m.forwardPE || 20));
  const [yrs, setYrs] = useState(3);
  const eps = isNum(baseEps) ? baseEps * (1 + g / 100) ** yrs : null;
  const target = isNum(eps) ? eps * pe : null;
  const irr = isNum(target) && m.price ? (target / m.price) ** (1 / (yrs + 1)) - 1 : null;
  return (
    <Card title="Return calculator" sub="Your assumptions → future price and annual return">
      <div className="grid g3" style={{ gap: 10 }}>
        <label className="sub">EPS growth %/yr<input type="number" value={g} onChange={(e) => setG(+e.target.value)} style={{ width: '100%' }} /></label>
        <label className="sub">Exit P/E<input type="number" value={pe} onChange={(e) => setPe(+e.target.value)} style={{ width: '100%' }} /></label>
        <label className="sub">Years after next FY<input type="number" value={yrs} min={1} max={10} onChange={(e) => setYrs(+e.target.value)} style={{ width: '100%' }} /></label>
      </div>
      <div className="stats" style={{ marginTop: 12 }}>
        <Stat label="Starting EPS" value={num(baseEps)} sub={m.estNext ? `FY${m.estNext.year} est` : 'TTM'} />
        <Stat label="Future EPS" value={num(eps)} />
        <Stat label="Future price" value={price(target)} />
        <Stat label="Annual return" value={pct(irr)} cls={irr > 0.1 ? 'pos' : irr < 0 ? 'neg' : ''} />
      </div>
    </Card>
  );
}
