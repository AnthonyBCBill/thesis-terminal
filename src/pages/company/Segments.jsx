import { Card, DataTable, Stat } from '../../components/ui.jsx';
import { MetricChart, Donut, HEX } from '../../components/charts.jsx';
import { money, pct, signPct, isNum } from '../../lib/format.js';

function SegmentBlock({ title, s, symbol }) {
  if (!s) return <Card title={title}><div className="empty">{symbol} doesn't report this breakdown in the data feed.</div></Card>;
  return (
    <>
      <div className="grid g2" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.5fr)' }}>
        <Card title={`${title} — revenue mix FY${s.year}`}>
          <Donut items={s.items} />
          {s.items.map((i, k) => (
            <div key={i.name} className="row" style={{ fontSize: 13, padding: '3px 0' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: HEX[k % 8] }} />
              <span style={{ flex: 1 }}>{i.name}</span><b className="mono">{pct(i.share)}</b>
            </div>
          ))}
        </Card>
        <Card title={`${title} — revenue over time`}>
          <MetricChart data={s.series.slice(-8)} series={s.names.slice(0, 8).map((n) => ({ key: n, name: n, type: 'bar' }))} stacked height={320} />
        </Card>
      </div>
      <Card title={`${title} detail`} sub="Growth uses 3-yr CAGR where available">
        <DataTable rows={s.items} initialSort={{ key: 'revenue', dir: -1 }} cols={[
          { key: 'name', label: 'Segment', txt: true }, { key: 'revenue', label: `Revenue FY${s.year}`, fmt: money },
          { key: 'share', label: '% of revenue', fmt: pct }, { key: 'shareChange', label: 'Mix change (pts)', fmt: (v) => (isNum(v) ? `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}` : '—'), cls: (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '') },
          { key: 'yoy', label: 'YoY growth', fmt: signPct, cls: (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '') },
          { key: 'cagr3', label: '3y CAGR', fmt: signPct, cls: (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '') },
          { key: 'trend', label: 'Outlook', txt: true, get: (r) => { const g = r.cagr3 ?? r.yoy; return !isNum(g) ? '—' : g > 0.15 ? 'Growing fast' : g > 0.03 ? 'Growing' : g > -0.03 ? 'Flat' : 'Shrinking'; },
            cls: (v) => (String(v).startsWith('Growing') ? 'pos' : v === 'Shrinking' ? 'neg' : '') },
        ]} />
      </Card>
    </>
  );
}

export default function Segments({ c, m, go }) {
  const s = m.segments;
  return (
    <div className="grid" style={{ gap: 16 }}>
      {s && (
        <div className="stats">
          <Stat label="Best seller" value={<span style={{ fontSize: 15 }}>{s.biggest?.name}</span>} sub={`${pct(s.biggest?.share)} of revenue`} />
          <Stat label="Fastest growing" value={<span style={{ fontSize: 15 }}>{s.fastest?.name || '—'}</span>} sub={s.fastest ? `${signPct(s.fastest.cagr3 ?? s.fastest.yoy)} · ${pct(s.fastest.share)} of rev` : ''} cls="pos" />
          <Stat label="Shrinking segments" value={s.shrinking.length} sub={s.shrinking.map((x) => x.name).join(', ') || 'None'} />
          <Stat label="Shrinking-segment risk" value={<span style={{ fontSize: 15 }}>{s.risk.split(':')[0]}</span>} sub={s.risk.split(':')[1] || ''} cls={s.shrinkShare > 0.3 ? 'neg' : s.shrinkShare > 0.1 ? 'warn' : 'pos'} />
        </div>
      )}
      <div className="info-box">
        Companies rarely report <b>margins by segment</b>, so data feeds don't have them. The AI Research Memo answers
        "why is this category growing" and "are margins higher on the growing or shrinking segment" using the earnings call and filings.{' '}
        <a href="#" onClick={(e) => { e.preventDefault(); go('memo'); }}>Open AI memo →</a>
      </div>
      <SegmentBlock title="Products & services" s={s} symbol={c.symbol} />
      <SegmentBlock title="Geography" s={m.geo} symbol={c.symbol} />
    </div>
  );
}
