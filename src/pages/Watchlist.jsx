import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserData } from '../lib/userdata.jsx';
import { useWatchlistEarnings } from '../lib/upcoming.js';
import { loadAI, parseGrade } from '../lib/ai.js';
import { GradeBadge } from './company/Grade.jsx';
import { loadPeers, peerRow } from '../lib/company.js';
import { Card, DataTable, Loading } from '../components/ui.jsx';
import TickerSearch from '../components/TickerSearch.jsx';
import { exportRows, PEER_COLS } from '../lib/excel.js';
import { PEER_TABLE_COLS } from './company/Competition.jsx';
import { price, pctRaw, tone } from '../lib/format.js';

export default function Watchlist() {
  const { data, toggleWatch } = useUserData();
  const [rows, setRows] = useState(null);
  const nav = useNavigate();
  const we = useWatchlistEarnings(data.watchlist);
  useEffect(() => {
    setRows(null);
    loadPeers(data.watchlist).then((cs) => setRows(cs.map((c) => ({ ...peerRow(c), change: c.m.changePct, next: c.m.nextEarnings }))));
  }, [data.watchlist.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const cols = [
    ...PEER_TABLE_COLS.slice(0, 2),
    { key: 'price', label: 'Price', fmt: price },
    { key: 'change', label: 'Day', fmt: (v) => pctRaw(v, 2), cls: tone },
    { key: 'grade', label: 'AI grade', nosort: true, get: (r) => parseGrade(loadAI(r.symbol, 'grade')?.text)?.overall || null, fmt: (v) => <GradeBadge grade={v} size={28} /> },
    { key: 'next', label: 'Next earnings', get: (r) => we.map[r.symbol]?.date || null, fmt: (v) => v || '—' },
    ...PEER_TABLE_COLS.slice(2),
    { key: 'rm', label: '', nosort: true, fmt: (_, r) => <button className="btn sm" onClick={(e) => { e.stopPropagation(); toggleWatch(r.symbol); }}>Remove</button> },
  ];
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="row"><h1>Watchlist</h1><span className="spacer" />
        <div style={{ width: 300 }}><TickerSearch onPick={(s) => !data.watchlist.includes(s) && toggleWatch(s)} placeholder="Add to watchlist…" /></div>
        {rows && <button className="btn sm" onClick={() => exportRows(rows, PEER_COLS, 'watchlist')}>Export to Excel</button>}
      </div>
      <Card title={`${data.watchlist.length} stocks`} sub="Valuation, growth and margins side by side. The daily briefing tracks these tickers.">
        {!rows ? <Loading label="Loading watchlist…" /> : <DataTable rows={rows} cols={cols} onRowClick={(r) => nav(`/c/${r.symbol}`)} initialSort={{ key: 'marketCap', dir: -1 }} />}
      </Card>
    </div>
  );
}
