import { useState } from 'react';
import { Card, Stat } from '../../components/ui.jsx';
import { PriceChart } from '../../components/charts.jsx';
import { money, pct, mult, num, price, isNum, signPct } from '../../lib/format.js';
import { loadAI } from '../../lib/ai.js';

const RANGES = [['6M', 182], ['1Y', 365], ['3Y', 1095], ['5Y', 1830]];

// Each item of the investor's decision checklist, answered from the data.
function buildChecklist({ c, m, avgs, peerRows }) {
  const a = avgs?.avg || {};
  const hasPeers = peerRows.length > 0;
  const memo = loadAI(c.symbol, 'memo');
  const ai = (why) => ({ s: memo ? 'b' : '', a: memo ? `${why} — covered in your AI memo (${memo.at.slice(0, 10)}).` : `${why} — generate the AI Research Memo to answer this.`, tab: 'memo' });
  const cmp = (v, avg, better = 'low') => {
    if (!isNum(v) || !isNum(avg) || v <= 0) return '';
    const r = v / avg;
    if (better === 'low') return r < 0.9 ? 'g' : r > 1.15 ? 'r' : 'y';
    return r > 1.1 ? 'g' : r < 0.9 ? 'r' : 'y';
  };
  const seg = m.segments;
  const opRank = hasPeers ? [...peerRows.map((p) => p.operating), m.margins.operating].filter(isNum).sort((x, y) => y - x).indexOf(m.margins.operating) + 1 : null;
  const D = m.durability.operating;

  return [
    { group: 'Valuation', items: [
      { q: 'Understand the valuation', s: cmp(m.forwardPE, a.forwardPE), a: `Trailing P/E ${mult(m.trailingPE)}, forward ${mult(m.forwardPE)}, PEG ${num(m.peg)}, EV/EBITDA ${mult(m.evEbitda)}. 5-yr avg P/E ${mult(m.pe5yAvg)}.`, tab: 'valuation' },
      { q: 'Trailing P/E of the company', s: cmp(m.trailingPE, a.trailingPE), a: `${mult(m.trailingPE)} vs peer avg ${mult(a.trailingPE)}`, tab: 'valuation' },
      { q: 'Forward P/E of the company', s: cmp(m.forwardPE, a.forwardPE), a: `${mult(m.forwardPE)} (FY${m.estNext?.year || '?'}) · ${mult(m.forwardPE2)} (FY${m.estNext2?.year || '?'}) vs peer avg ${mult(a.forwardPE)}`, tab: 'valuation' },
      { q: 'Trailing & forward P/E of all peers', s: hasPeers ? 'b' : '', a: hasPeers ? peerRows.slice(0, 6).map((p) => `${p.symbol} ${mult(p.trailingPE)}/${mult(p.forwardPE)}`).join(' · ') : 'Click "Load competitor comparisons" (or open the Competition tab).', tab: 'competition' },
      { q: 'Guidance & growth', s: m.epsGrowthNext > 0.1 ? 'g' : m.epsGrowthNext < 0 ? 'r' : 'y', a: `Consensus next FY: revenue ${signPct(m.revGrowthNext)}, EPS ${signPct(m.epsGrowthNext)}. FY+2: revenue ${signPct(m.revGrowthNext2)}, EPS ${signPct(m.epsGrowthNext2)}. Management guidance is in the transcript analysis.`, tab: 'earnings' },
    ] },
    { group: 'Industry, competition & moat', items: [
      { q: 'Understand the industry', ...ai(`${m.industry || 'Industry'} (${m.sector || ''})`), tab: 'memo' },
      { q: 'Understand the competition', s: hasPeers ? 'b' : '', a: hasPeers ? `${peerRows.length} peers tracked. ${c.symbol} ranks #${opRank} of ${peerRows.length + 1} on operating margin.` : 'Open the Competition tab to load competitors.', tab: 'competition' },
      { q: 'Competitors’ margins', s: cmp(m.margins.operating, a.operating, 'high'), a: `Peer avg: gross ${pct(a.gross)}, operating ${pct(a.operating)}, net ${pct(a.net)}`, tab: 'competition' },
      { q: 'Industry average margins', s: cmp(m.margins.net, a.net, 'high'), a: `Peer-group average (industry proxy): gross ${pct(a.gross)} · op ${pct(a.operating)} · net ${pct(a.net)} vs ${c.symbol} ${pct(m.margins.gross)} · ${pct(m.margins.operating)} · ${pct(m.margins.net)}`, tab: 'margins' },
      { q: 'Do they have a moat, and what is it?', s: memo ? 'b' : (m.durability.gross.verdict.startsWith('Very') && m.roic > 0.15 ? 'g' : ''), a: `Signals: ROIC ${pct(m.roic)}, gross margin ${m.durability.gross.verdict.toLowerCase()}. ${memo ? 'Moat type in AI memo.' : 'Generate the AI memo for moat type and evidence.'}`, tab: 'memo' },
      { q: 'How long margins have held & can they sustain', s: D.verdict.startsWith('Very') || D.verdict.startsWith('Stable') ? 'g' : D.verdict.startsWith('Volatile') ? 'r' : 'y', a: `Operating margin: ${D.verdict} over ${D.years} yrs (range ${pct(D.min)}–${pct(D.max)}, 10y avg ${pct(D.avg10)}).`, tab: 'margins' },
      { q: 'Market fit', ...ai(`Revenue CAGR 5y ${pct(m.revCagr5)}, beat EPS ${m.beats}/${m.reportedCount} qtrs`), tab: 'memo' },
    ] },
    { group: 'Products & segments', items: [
      { q: 'Best-selling products / services', s: seg ? 'b' : '', a: seg ? seg.items.slice(0, 3).map((i) => `${i.name} ${pct(i.share)}`).join(' · ') : 'Segment data not available for this company.', tab: 'segments' },
      { q: 'What products they have and why they’re better', ...ai('Product positioning'), tab: 'memo' },
      { q: 'Where is most of the growth?', s: seg?.fastest ? 'g' : '', a: seg?.fastest ? `${seg.fastest.name}: ${pct(seg.fastest.cagr3 ?? seg.fastest.yoy)} ${isNum(seg.fastest.cagr3) ? '3-yr CAGR' : 'YoY'} (${pct(seg.fastest.share)} of revenue)` : '—', tab: 'segments' },
      { q: 'Why is that category growing?', ...ai(seg?.fastest ? `Driver of ${seg.fastest.name}` : 'Growth drivers'), tab: 'memo' },
      { q: '% of revenue from each product / service', s: seg ? 'b' : '', a: seg ? `${seg.items.length} segments reported (FY${seg.year})` : '—', tab: 'segments' },
      { q: 'Which segment will grow / shrink? Is the shrinking one a danger?', s: !seg ? '' : seg.shrinkShare > 0.3 ? 'r' : seg.shrinkShare > 0.1 ? 'y' : 'g', a: seg ? `${seg.risk} ${seg.shrinking.length ? `Shrinking: ${seg.shrinking.map((s) => s.name).join(', ')}.` : ''}` : '—', tab: 'segments' },
      { q: 'Higher margins on growing or shrinking segment?', ...ai('Segment margins are rarely in data feeds'), tab: 'memo' },
    ] },
    { group: 'Balance sheet & cash flow', items: [
      { q: 'Total debt', s: '', a: `${money(m.totalDebt)} (short-term ${money(m.shortTermDebt)}, long-term ${money(m.longTermDebt)})`, tab: 'debt' },
      { q: 'Total cash', s: m.cash > m.totalDebt ? 'g' : '', a: `${money(m.cash)} cash & short-term investments → net ${m.netDebt > 0 ? 'debt' : 'cash'} ${money(Math.abs(m.netDebt ?? NaN))}`, tab: 'debt' },
      { q: 'Financing obligations', s: '', a: `Lease obligations ${money(m.leases)}${isNum(m.leasesCurrent) ? ` (${money(m.leasesCurrent)} due within a year)` : ''}; debt due within a year ${money(m.shortTermDebt)}.`, tab: 'debt' },
      { q: 'Debt profile & ability to service it', s: { Strong: 'g', Moderate: 'y', Elevated: 'y', High: 'r' }[m.debtRating.grade] || '', a: `${m.debtRating.grade}: ${m.debtRating.note} Interest coverage ${mult(m.interestCoverage)}, ${isNum(m.yearsToRepay) ? `${m.yearsToRepay.toFixed(1)} yrs of FCF to repay net debt` : ''}.`, tab: 'debt' },
      { q: 'Cash flow', s: m.ttm.fcf > 0 ? 'g' : 'r', a: `TTM operating CF ${money(m.ttm.ocf)}, FCF ${money(m.ttm.fcf)} (${pct(m.margins.fcf)} margin), FCF/net income ${num(m.ttm.fcf / m.ttm.netIncome)}`, tab: 'cashflow' },
      { q: 'Net, gross and operating margins', s: '', a: `Gross ${pct(m.margins.gross)} · Operating ${pct(m.margins.operating)} · Net ${pct(m.margins.net)} (TTM)`, tab: 'margins' },
    ] },
    { group: 'Management & go-to-market', items: [
      { q: 'Talent & experience of management', s: '', a: `CEO ${c.profile.ceo || '—'}. See executives, tenure, pay and insider activity.`, tab: 'management' },
      { q: 'Updates on management', s: '', a: 'Leadership changes, insider trades and headlines are on the Management tab.', tab: 'management' },
      { q: 'Marketing budget & strategy', s: '', a: isNum(m.ttm.marketing) ? `S&M ${money(m.ttm.marketing)} TTM = ${pct(m.ttm.marketing / m.ttm.revenue)} of revenue. Strategy in AI memo.` : `Company doesn't break out S&M; SG&A is ${pct(m.ttm.sga / m.ttm.revenue)} of revenue.`, tab: 'memo' },
    ] },
  ];
}

export default function Overview(props) {
  const { c, m, go, peersPending, loadPeersNow } = props;
  const [range, setRange] = useState(365);
  const since = new Date(Date.now() - range * 864e5).toISOString().slice(0, 10);
  const pr = c.prices.filter((p) => p.date >= since);
  const chg = pr.length ? pr.at(-1).price / pr[0].price - 1 : null;
  const groups = buildChecklist(props);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="grid g2" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)' }}>
        <Card title="Price" sub={chg != null ? <span className={chg >= 0 ? 'pos' : 'neg'}>{signPct(chg)} over period</span> : null}
          right={<div className="seg">{RANGES.map(([l, d]) => <button key={l} className={range === d ? 'on' : ''} onClick={() => setRange(d)}>{l}</button>)}</div>}>
          <PriceChart data={pr} />
        </Card>
        <Card title="About">
          <p className="muted" style={{ margin: 0, fontSize: 13, display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.profile.description || '—'}</p>
          <div className="stats" style={{ marginTop: 12, gridTemplateColumns: '1fr 1fr' }}>
            <Stat label="CEO" value={<span style={{ fontSize: 14, fontFamily: 'Inter' }}>{c.profile.ceo || '—'}</span>} />
            <Stat label="Employees" value={c.profile.fullTimeEmployees ? Number(c.profile.fullTimeEmployees).toLocaleString() : '—'} />
            <Stat label="Analyst target" value={price(m.targetPrice)} sub={m.upside != null ? <span className={m.upside > 0 ? 'pos' : 'neg'}>{signPct(m.upside)} upside</span> : null} />
            <Stat label="Consensus" value={<span style={{ fontSize: 14, fontFamily: 'Inter' }}>{c.grades.consensus || '—'}</span>} sub={c.grades.buy != null ? `${(c.grades.strongBuy || 0) + c.grades.buy} buy · ${c.grades.hold} hold · ${(c.grades.sell || 0) + (c.grades.strongSell || 0)} sell` : null} />
          </div>
        </Card>
      </div>

      <div className="stats">
        <Stat label="Trailing P/E" value={mult(m.trailingPE)} sub={`5y avg ${mult(m.pe5yAvg)}`} />
        <Stat label={`Forward P/E (FY${m.estNext?.year || ''})`} value={mult(m.forwardPE)} sub={`FY+2 ${mult(m.forwardPE2)}`} />
        <Stat label="PEG" value={num(m.peg)} sub="fwd P/E ÷ EPS growth" />
        <Stat label="EV / EBITDA" value={mult(m.evEbitda)} />
        <Stat label="Revenue (TTM)" value={money(m.ttm.revenue)} sub={`5y CAGR ${pct(m.revCagr5)}`} />
        <Stat label="Gross / Op margin" value={`${pct(m.margins.gross, 0)} / ${pct(m.margins.operating, 0)}`} sub={`Net ${pct(m.margins.net)}`} />
        <Stat label="Free cash flow (TTM)" value={money(m.ttm.fcf)} sub={`Yield ${pct(m.fcfYield)}`} />
        <Stat label="Net debt" value={money(m.netDebt)} sub={m.netDebt > 0 ? `${m.debtRating.grade} · ${mult(m.netDebtToEbitda)} EBITDA` : "Net cash position"} />
      </div>

      <Card title="Decision checklist" sub="Your research framework, answered from the data. Click any row to dig in. Blue = see AI memo / detail tab."
        right={peersPending ? <button className="btn sm" onClick={loadPeersNow} title="Uses about 6 data requests per competitor">Load competitor comparisons</button> : null}>
        <div className="grid g2" style={{ gap: '4px 28px' }}>
          {groups.map((g) => (
            <div key={g.group}>
              <div className="nav-sec" style={{ paddingLeft: 0 }}>{g.group}</div>
              {g.items.map((it) => (
                <div key={it.q} className="check" style={{ cursor: 'pointer' }} onClick={() => go(it.tab)}>
                  <span className={`dot ${it.s || ''}`} />
                  <div><div className="q">{it.q}</div><div className="a">{it.a}</div></div>
                  <span className="sub">›</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
