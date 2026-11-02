import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadCompany, loadPeers, peerRow, peerAverages } from '../lib/company.js';
import { useUserData } from '../lib/userdata.jsx';
import { isEco } from '../lib/api.js';
import { exportCompany } from '../lib/excel.js';
import { money, price, signPct, tone, pctRaw } from '../lib/format.js';
import { Tabs, Loading, Err, Icon } from '../components/ui.jsx';
import Overview from './company/Overview.jsx';
import Valuation from './company/Valuation.jsx';
import Financials from './company/Financials.jsx';
import Margins from './company/Margins.jsx';
import Segments from './company/Segments.jsx';
import Debt from './company/Debt.jsx';
import CashFlow from './company/CashFlow.jsx';
import Competition from './company/Competition.jsx';
import Management from './company/Management.jsx';
import Earnings from './company/Earnings.jsx';
import Memo from './company/Memo.jsx';
import Notes from './company/Notes.jsx';

const TABS = [
  { id: 'overview', label: 'Overview & Checklist' },
  { id: 'valuation', label: 'Valuation & Growth' },
  { id: 'financials', label: 'Financials' },
  { id: 'margins', label: 'Margins' },
  { id: 'segments', label: 'Products & Segments' },
  { id: 'debt', label: 'Debt & Cash' },
  { id: 'cashflow', label: 'Cash Flow' },
  { id: 'competition', label: 'Competition' },
  { id: 'management', label: 'Management' },
  { id: 'earnings', label: 'Earnings & Transcripts' },
  { id: 'memo', label: 'AI Research Memo' },
  { id: 'notes', label: 'My Notes' },
];

export default function Company() {
  const { symbol: rawSym, tab = 'overview' } = useParams();
  const symbol = rawSym.toUpperCase();
  const nav = useNavigate();
  const { data: ud, toggleWatch } = useUserData();
  const [c, setC] = useState(null);
  const [err, setErr] = useState('');
  const [peers, setPeers] = useState(null);
  const [peerLoading, setPeerLoading] = useState(false);
  const [peersWanted, setPeersWanted] = useState(false);
  // Economy mode: competitors (≈6 requests each) load only on tabs that need them.
  const PEER_TABS = ['valuation', 'margins', 'competition', 'memo', 'debt'];
  const wantPeers = !isEco() || peersWanted || PEER_TABS.includes(tab);
  const maxPeers = isEco() ? 5 : 10;

  useEffect(() => {
    let live = true;
    setC(null); setErr(''); setPeers(null); setPeersWanted(false);
    loadCompany(symbol).then((d) => {
      if (!live) return;
      if (!d.profile?.symbol && !d.incomeA.length) setErr(Object.values(d.errors)[0] || `No data found for ${symbol}.`);
      setC(d);
    }).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [symbol]);

  const peerList = useMemo(() => (ud.peers[symbol]?.length ? ud.peers[symbol] : c?.peers || []), [ud.peers, symbol, c]);

  useEffect(() => {
    if (!c || !wantPeers) return;
    let live = true;
    setPeerLoading(true);
    loadPeers(peerList.slice(0, maxPeers)).then((ps) => { if (live) { setPeers(ps); setPeerLoading(false); } });
    return () => { live = false; };
  }, [c, peerList.join(','), wantPeers]); // eslint-disable-line react-hooks/exhaustive-deps

  const peerRows = useMemo(() => (peers || []).map(peerRow), [peers]);
  const avgs = useMemo(() => (peerRows.length ? peerAverages(peerRows) : null), [peerRows]);

  if (err && !c?.incomeA?.length) return <div className="card card-b"><Err>{err}</Err><p className="sub">Check the ticker, or open Settings to confirm your data key is working.</p></div>;
  if (!c) return <Loading label={`Loading ${symbol}…`} h={300} />;

  const m = c.m;
  const watching = ud.watchlist.includes(symbol);
  const props = { c, m, peers, peerRows, avgs, peerLoading: peerLoading || (wantPeers && !peers), peersPending: !wantPeers, loadPeersNow: () => setPeersWanted(true), peerList, go: (t) => nav(`/c/${symbol}/${t}`) };

  return (
    <div>
      <div className="co-head">
        {c.profile.image && <img className="co-logo" src={c.profile.image} alt="" onError={(e) => { e.target.style.display = 'none'; }} />}
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <h1>{m.name}</h1>
            <span className="chip mono">{symbol}</span>
            {c.profile.exchange && <span className="sub">{c.profile.exchange}</span>}
          </div>
          <div className="sub">{[m.sector, m.industry].filter(Boolean).join(' · ')}{m.nextEarnings && <> · <b style={{ color: 'var(--accent)' }}>Next earnings {m.nextEarnings}</b></>}</div>
        </div>
        <div className="spacer" />
        <div style={{ textAlign: 'right' }}>
          <div className="co-price">{price(m.price)}</div>
          <div className={`mono ${tone(m.changePct)}`} style={{ fontSize: 13 }}>{m.changePct != null ? `${m.changePct > 0 ? '+' : ''}${pctRaw(m.changePct, 2)} · ` : ''}{money(m.marketCap)} mkt cap</div>
        </div>
        <div className="row">
          <button className={`btn ${watching ? 'primary' : ''}`} onClick={() => toggleWatch(symbol)}><Icon name="star" size={14} filled={watching} />{watching ? 'Watching' : 'Watch'}</button>
          <button className="btn" onClick={() => exportCompany(c, peerRows, avgs)} title="Download Excel workbook"><Icon name="xls" size={14} />Excel</button>
        </div>
      </div>
      {Object.keys(c.errors).length > 0 && (
        <details className="note-box" style={{ marginBottom: 12 }}>
          <summary>Some data couldn't be loaded ({Object.keys(c.errors).length}) — usually your FMP plan doesn't include it.</summary>
          <ul style={{ margin: '6px 0 0' }}>{Object.entries(c.errors).map(([k, v]) => <li key={k}><b>{k}</b>: {String(v).slice(0, 160)}</li>)}</ul>
        </details>
      )}
      <Tabs tabs={TABS} value={tab} onChange={(t) => nav(`/c/${symbol}/${t}`)} />
      {tab === 'overview' && <Overview {...props} />}
      {tab === 'valuation' && <Valuation {...props} />}
      {tab === 'financials' && <Financials {...props} />}
      {tab === 'margins' && <Margins {...props} />}
      {tab === 'segments' && <Segments {...props} />}
      {tab === 'debt' && <Debt {...props} />}
      {tab === 'cashflow' && <CashFlow {...props} />}
      {tab === 'competition' && <Competition {...props} />}
      {tab === 'management' && <Management {...props} />}
      {tab === 'earnings' && <Earnings {...props} />}
      {tab === 'memo' && <Memo {...props} />}
      {tab === 'notes' && <Notes {...props} />}
    </div>
  );
}
