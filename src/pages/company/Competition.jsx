import { useNavigate } from 'react-router-dom';
import { Card, DataTable, Loading } from '../../components/ui.jsx';
import TickerSearch from '../../components/TickerSearch.jsx';
import { MetricChart } from '../../components/charts.jsx';
import { useUserData } from '../../lib/userdata.jsx';
import { peerRow } from '../../lib/company.js';
import { exportRows, PEER_COLS } from '../../lib/excel.js';
import { money, pct, mult, num, signPct, isNum, lev } from '../../lib/format.js';

const posneg = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');

export const PEER_TABLE_COLS = [
  { key: 'symbol', label: 'Ticker', fmt: (v, r) => <b className="mono">{v}</b> },
  { key: 'name', label: 'Company', txt: true, fmt: (v, r) => <><span style={{ maxWidth: 170, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }}>{v}</span>{r.covered === false && <span className="chip warn" style={{ marginLeft: 6 }}>not on free plan</span>}</> },
  { key: 'marketCap', label: 'Mkt cap', fmt: money },
  { key: 'trailingPE', label: 'P/E TTM', fmt: mult }, { key: 'forwardPE', label: 'P/E fwd', fmt: mult }, { key: 'forwardPE2', label: 'P/E FY+2', fmt: mult },
  { key: 'peg', label: 'PEG', fmt: (v) => num(v) }, { key: 'evEbitda', label: 'EV/EBITDA', fmt: mult }, { key: 'ps', label: 'P/S', fmt: mult },
  { key: 'revGrowthNext', label: 'Rev gr. fwd', fmt: signPct, cls: posneg }, { key: 'epsGrowthNext', label: 'EPS gr. fwd', fmt: signPct, cls: posneg },
  { key: 'gross', label: 'Gross', fmt: pct }, { key: 'operating', label: 'Op.', fmt: pct }, { key: 'net', label: 'Net', fmt: pct }, { key: 'fcfMargin', label: 'FCF', fmt: pct },
  { key: 'roic', label: 'ROIC', fmt: pct }, { key: 'netDebtToEbitda', label: 'ND/EBITDA', fmt: lev }, { key: 'marketingPct', label: 'S&M %', fmt: pct },
];

export default function Competition({ c, m, peerRows, avgs, peerLoading, peerList }) {
  const { setPeers } = useUserData();
  const nav = useNavigate();
  const self = peerRow(c);
  const rows = [self, ...peerRows];
  const uncovered = rows.filter((r) => r.covered === false);
  const foot = avgs ? [{ symbol: 'AVG', name: 'Peer average', ...avgs.avg }, { symbol: 'MED', name: 'Peer median', ...avgs.med }] : [];
  const add = (s) => { if (s !== c.symbol && !peerList.includes(s)) setPeers(c.symbol, [...peerList, s]); };
  const remove = (s) => setPeers(c.symbol, peerList.filter((x) => x !== s));
  const chartRows = [...rows].filter((r) => isNum(r.revGrowthNext));

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card title="Peer group" sub="Auto-suggested by sector & size. Add or remove competitors — saved per company." right={
        <button className="btn sm" onClick={() => setPeers(c.symbol, [])}>Reset to default</button>}>
        <div className="row" style={{ marginBottom: 10 }}>
          {peerList.map((s) => <span key={s} className="chip mono">{s}<button onClick={() => remove(s)} style={{ border: 0, background: 'none', color: 'var(--text-3)', padding: 0, marginLeft: 2 }}>×</button></span>)}
        </div>
        <div style={{ maxWidth: 360 }}><TickerSearch onPick={add} placeholder="Add a competitor…" /></div>
      </Card>

      {uncovered.length > 0 && (
        <div className="note-box">
          <b>{uncovered.map((r) => r.symbol).join(', ')}</b> {uncovered.length === 1 ? "isn't" : "aren't"} covered by FMP's free plan, so only price and market cap show for {uncovered.length === 1 ? 'it' : 'them'}.
          FMP's free plan covers a limited list of tickers; the Starter plan (about $22/month billed annually) covers every US stock.
          You can also swap in competitors that are covered using "Add a competitor" above.
        </div>
      )}
      <Card title="Competitive comparison (TTM & consensus)" right={
        <button className="btn sm" onClick={() => exportRows([...rows, ...foot], PEER_COLS, `${c.symbol}_peers`)}>Export to Excel</button>}>
        {peerLoading && !peerRows.length ? <Loading label="Loading peers…" /> :
          <DataTable rows={rows} cols={PEER_TABLE_COLS} footRows={foot} highlight={(r) => r.symbol === c.symbol}
            initialSort={{ key: 'marketCap', dir: -1 }} onRowClick={(r) => r.symbol !== c.symbol && nav(`/c/${r.symbol}`)} />}
      </Card>

      <div className="grid g2">
        <Card title="Growth vs valuation" sub="Next-FY revenue growth vs forward P/E">
          <MetricChart data={chartRows} x="symbol" series={[{ key: 'revGrowthNext', name: 'Rev growth (fwd)', type: 'bar' }]} kind="pct" />
        </Card>
        <Card title="Net margin vs peers">
          <MetricChart data={[...rows].sort((a, b) => (b.net ?? -9) - (a.net ?? -9))} x="symbol" series={[{ key: 'gross', name: 'Gross', type: 'bar' }, { key: 'operating', name: 'Operating', type: 'bar' }, { key: 'net', name: 'Net', type: 'bar' }]} kind="pct" />
        </Card>
      </div>
    </div>
  );
}
