// Watchlist, notes and custom peer groups — synced to Netlify Blobs, cached locally.
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api } from './api.js';

const LS = 'thesis:userdata';
const DEFAULT = { watchlist: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL'], notes: {}, peers: {}, settings: {} };
const Ctx = createContext(null);

export function UserDataProvider({ children }) {
  const [data, setData] = useState(() => {
    try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(LS)) }; } catch { return DEFAULT; }
  });
  const [synced, setSynced] = useState('loading');
  const timer = useRef(null);

  useEffect(() => {
    api('/api/userdata').then((d) => { setData({ ...DEFAULT, ...d }); setSynced('ok'); })
      .catch(() => setSynced('offline'));
  }, []);

  const update = useCallback((fn) => {
    setData((prev) => {
      const next = typeof fn === 'function' ? fn(prev) : { ...prev, ...fn };
      localStorage.setItem(LS, JSON.stringify(next));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        api('/api/userdata', { method: 'PUT', body: JSON.stringify(next) }).then(() => setSynced('ok')).catch(() => setSynced('offline'));
      }, 600);
      return next;
    });
  }, []);

  const toggleWatch = (sym) => update((d) => ({
    ...d, watchlist: d.watchlist.includes(sym) ? d.watchlist.filter((s) => s !== sym) : [...d.watchlist, sym],
  }));
  const setNote = (sym, text) => update((d) => ({ ...d, notes: { ...d.notes, [sym]: text } }));
  const setPeers = (sym, list) => update((d) => ({ ...d, peers: { ...d.peers, [sym]: list } }));

  return <Ctx.Provider value={{ data, update, toggleWatch, setNote, setPeers, synced }}>{children}</Ctx.Provider>;
}

export const useUserData = () => useContext(Ctx);
