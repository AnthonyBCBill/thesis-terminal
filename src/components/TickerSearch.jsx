import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmp } from '../lib/api.js';
import { Icon } from './ui.jsx';

export default function TickerSearch({ onPick, placeholder = 'Search ticker or company…', autoFocus }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const nav = useNavigate();
  const t = useRef();

  useEffect(() => {
    clearTimeout(t.current);
    if (!q.trim()) { setRes([]); return; }
    t.current = setTimeout(async () => {
      try {
        const [a, b] = await Promise.all([
          fmp('search-symbol', { query: q, limit: 8 }).catch(() => []),
          fmp('search-name', { query: q, limit: 8 }).catch(() => []),
        ]);
        const seen = new Set(); const all = [];
        for (const r of [...(a || []), ...(b || [])]) if (r?.symbol && !seen.has(r.symbol)) { seen.add(r.symbol); all.push(r); }
        // Prefer US listings
        all.sort((x, y) => (/NASDAQ|NYSE|AMEX/.test(y.exchange || y.exchangeShortName || '') ? 1 : 0) - (/NASDAQ|NYSE|AMEX/.test(x.exchange || x.exchangeShortName || '') ? 1 : 0));
        setRes(all.slice(0, 10)); setHi(0);
      } catch { setRes([]); }
    }, 220);
  }, [q]);

  const pick = (sym) => {
    setQ(''); setOpen(false);
    if (onPick) onPick(sym.toUpperCase()); else nav(`/c/${sym.toUpperCase()}`);
  };

  return (
    <div className="search">
      <span className="icon"><Icon name="search" size={15} /></span>
      <input
        value={q} autoFocus={autoFocus} placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setHi((h) => Math.min(h + 1, res.length - 1));
          if (e.key === 'ArrowUp') setHi((h) => Math.max(h - 1, 0));
          if (e.key === 'Enter') { const r = res[hi]; pick(r ? r.symbol : q.trim()); }
        }}
      />
      {open && q && (
        <div className="search-results">
          {res.map((r, i) => (
            <button key={r.symbol} className={i === hi ? 'hi' : ''} onMouseDown={() => pick(r.symbol)}>
              <b className="mono" style={{ minWidth: 64 }}>{r.symbol}</b>
              <span className="muted" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              <span className="sub">{r.exchange || r.exchangeShortName}</span>
            </button>
          ))}
          {!res.length && <button onMouseDown={() => pick(q.trim())}>Go to <b className="mono">{q.toUpperCase()}</b></button>}
        </div>
      )}
    </div>
  );
}
