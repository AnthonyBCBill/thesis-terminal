import { NavLink, Route, Routes, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getAppKey, setAppKey } from './lib/api.js';
import TickerSearch from './components/TickerSearch.jsx';
import { Icon } from './components/ui.jsx';
import { useUserData } from './lib/userdata.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Calendar from './pages/Calendar.jsx';
import Company from './pages/Company.jsx';
import Compare from './pages/Compare.jsx';
import Settings from './pages/Settings.jsx';
import Watchlist from './pages/Watchlist.jsx';

// Private lock screen: shown until the device has the APP_PASSWORD set in Netlify.
function Lock({ onOk }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const go = async (e) => {
    e.preventDefault();
    const r = await fetch('/api/userdata', { headers: { 'x-app-key': pw } });
    if (r.ok) { setAppKey(pw); onOk(); window.location.reload(); } else setErr('Wrong password');
  };
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <form onSubmit={go} className="card card-b" style={{ width: 340, display: 'grid', gap: 12 }}>
        <div className="brand" style={{ padding: 0 }}><div className="brand-mark">T</div>Thesis</div>
        <div className="muted">This app is private. Enter your password.</div>
        <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" />
        {err && <div className="err">{err}</div>}
        <button className="btn primary" style={{ justifyContent: 'center' }}>Unlock</button>
      </form>
    </div>
  );
}

export default function App() {
  const [locked, setLocked] = useState(null);
  useEffect(() => {
    fetch('/api/userdata', { headers: { 'x-app-key': getAppKey() } }).then((r) => setLocked(r.status === 401)).catch(() => setLocked(false));
  }, []);
  if (locked === null) return null;
  if (locked) return <Lock onOk={() => setLocked(false)} />;
  return <Shell />;
}

function Shell() {
  const { data } = useUserData();
  const [theme, setTheme] = useState(document.documentElement.dataset.theme);
  const flip = () => {
    const t = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t; localStorage.setItem('thesis:theme', t); setTheme(t);
  };
  const nav = [
    { to: '/', icon: 'home', label: 'Briefing', end: true },
    { to: '/calendar', icon: 'cal', label: 'Earnings' },
    { to: '/watchlist', icon: 'star', label: 'Watchlist' },
    { to: '/compare', icon: 'compare', label: 'Compare' },
    { to: '/settings', icon: 'gear', label: 'Settings' },
  ];
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">T</div>Thesis</div>
        <nav className="nav">
          {nav.map((n) => <NavLink key={n.to} to={n.to} end={n.end}><Icon name={n.icon} />{n.label}</NavLink>)}
        </nav>
        <div className="nav-sec">Watchlist</div>
        <div className="side-watch" style={{ overflowY: 'auto', flex: 1 }}>
          {data.watchlist.map((s) => <Link key={s} to={`/c/${s}`}><span className="mono">{s}</span></Link>)}
        </div>
        <button className="btn sm" onClick={flip}><Icon name="moon" size={14} />{theme === 'dark' ? 'Light' : 'Dark'} mode</button>
      </aside>
      <main className="main">
        <div className="topbar">
          <TickerSearch />
        </div>
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/settings" element={<Settings theme={theme} flip={flip} />} />
            <Route path="/c/:symbol" element={<Company />} />
            <Route path="/c/:symbol/:tab" element={<Company />} />
          </Routes>
        </div>
      </main>
      <nav className="bottom-nav">
        {nav.map((n) => <NavLink key={n.to} to={n.to} end={n.end}><Icon name={n.icon} size={20} />{n.label}</NavLink>)}
      </nav>
    </div>
  );
}
