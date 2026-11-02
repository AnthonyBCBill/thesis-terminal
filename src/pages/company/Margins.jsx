import { Card, DataTable, Loading } from '../../components/ui.jsx';
import { Lines, HBar } from '../../components/charts.jsx';
import { pct, isNum } from '../../lib/format.js';

const LABEL = { gross: 'Gross margin', operating: 'Operating margin', net: 'Net margin', fcfMargin: 'FCF margin' };

export default function Margins({ c, m, peerRows, avgs, peerLoading }) {
  const a = avgs?.avg || {}, md = avgs?.med || {};
  const rows = [
    { metric: 'Gross margin', co: m.margins.gross, avg: a.gross, med: md.gross },
    { metric: 'Operating margin', co: m.margins.operating, avg: a.operating, med: md.operating },
    { metric: 'Net margin', co: m.margins.net, avg: a.net, med: md.net },
    { metric: 'FCF margin', co: m.margins.fcf, avg: a.fcfMargin, med: md.fcfMargin },
  ].map((r) => ({ ...r, diff: isNum(r.co) && isNum(r.avg) ? r.co - r.avg : null }));
  const durRows = Object.entries(m.durability).map(([k, d]) => ({ metric: LABEL[k], ...d }));
  const peerOp = [...peerRows, { symbol: c.symbol, operating: m.margins.operating, gross: m.margins.gross, net: m.margins.net }].filter((r) => isNum(r.operating)).sort((x, y) => y.operating - x.operating);
  const peerGross = [...peerOp].filter((r) => isNum(r.gross)).sort((x, y) => y.gross - x.gross);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card title="Margin history" sub={`${m.history.length} fiscal years`}>
        <Lines data={m.history} keys={[{ key: 'gross', name: 'Gross' }, { key: 'operating', name: 'Operating' }, { key: 'net', name: 'Net' }, { key: 'fcfMargin', name: 'FCF' }]} />
      </Card>

      <div className="grid g2">
        <Card title={`${c.symbol} vs industry average`} sub="Industry average = average of the peer group (TTM). Edit peers on the Competition tab.">
          {peerLoading && !peerRows.length ? <Loading /> : (
            <DataTable rows={rows} cols={[
              { key: 'metric', label: 'Margin', txt: true, nosort: true },
              { key: 'co', label: c.symbol, fmt: pct }, { key: 'avg', label: 'Peer avg', fmt: pct }, { key: 'med', label: 'Peer median', fmt: pct },
              { key: 'diff', label: 'vs avg', fmt: (v) => (isNum(v) ? `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)} pts` : '—'), cls: (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '') },
            ]} />
          )}
        </Card>
        <Card title="Margin durability" sub="How long margins have held, and whether they can be sustained (last 10 yrs)">
          <DataTable rows={durRows} cols={[
            { key: 'metric', label: 'Margin', txt: true, nosort: true },
            { key: 'current', label: 'Latest FY', fmt: pct }, { key: 'avg5', label: '5y avg', fmt: pct }, { key: 'avg10', label: '10y avg', fmt: pct },
            { key: 'min', label: 'Low', fmt: pct }, { key: 'max', label: 'High', fmt: pct },
            { key: 'verdict', label: 'Verdict', txt: true, nosort: true, cls: (v) => (String(v).startsWith('Very') || String(v).startsWith('Stable') ? 'pos' : String(v).startsWith('Volatile') ? 'neg' : 'warn') },
          ]} />
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Operating margin vs competitors (TTM)">{peerOp.length > 1 ? <HBar rows={peerOp} valueKey="operating" highlight={(r) => r.symbol === c.symbol} /> : <Loading />}</Card>
        <Card title="Gross margin vs competitors (TTM)">{peerGross.length > 1 ? <HBar rows={peerGross} valueKey="gross" highlight={(r) => r.symbol === c.symbol} /> : <Loading />}</Card>
      </div>

      <Card title="Margins by year">
        <DataTable rows={[...m.history].reverse()} cols={[
          { key: 'year', label: 'FY', txt: true }, { key: 'gross', label: 'Gross', fmt: pct }, { key: 'operating', label: 'Operating', fmt: pct },
          { key: 'net', label: 'Net', fmt: pct }, { key: 'fcfMargin', label: 'FCF', fmt: pct }, { key: 'rndPct', label: 'R&D % rev', fmt: pct },
          { key: 'sgaPct', label: 'SG&A % rev', fmt: pct }, { key: 'marketingPct', label: 'S&M % rev', fmt: pct },
        ]} />
      </Card>
    </div>
  );
}
