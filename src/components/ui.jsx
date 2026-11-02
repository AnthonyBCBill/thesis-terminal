import { useMemo, useState } from 'react';
import { isNum } from '../lib/format.js';

export function Card({ title, sub, right, children, className = '', pad = true }) {
  return (
    <div className={`card ${className}`}>
      {(title || right) && (
        <div className="card-h">
          <div><h3>{title}</h3>{sub && <div className="sub">{sub}</div>}</div>
          {right}
        </div>
      )}
      <div className={pad ? 'card-b' : ''}>{children}</div>
    </div>
  );
}

export function Stat({ label, value, sub, cls = '' }) {
  return (
    <div className="stat">
      <div className="l">{label}</div>
      <div className={`v ${cls}`}>{value}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.id} className={value === t.id ? 'on' : ''} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

export function Seg({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export const Spinner = () => <span className="spin" />;
export const Loading = ({ label = 'Loading…', h = 120 }) => (
  <div className="row" style={{ justifyContent: 'center', height: h, color: 'var(--text-3)' }}><Spinner /> {label}</div>
);
export const Err = ({ children }) => (children ? <div className="err">{children}</div> : null);
export const Empty = ({ children }) => <div className="empty">{children}</div>;

// Sortable data table. cols: [{key,label,fmt?,get?,cls?,txt?}]
export function DataTable({ rows, cols, highlight, initialSort, footRows = [], onRowClick, maxHeight }) {
  const [sort, setSort] = useState(initialSort || null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = cols.find((c) => c.key === sort.key);
    const val = (r) => (col?.get ? col.get(r) : r[sort.key]);
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      if (!isNum(x) && !isNum(y)) return String(x ?? '').localeCompare(String(y ?? '')) * sort.dir;
      if (!isNum(x)) return 1; if (!isNum(y)) return -1;
      return (x - y) * sort.dir;
    });
  }, [rows, sort, cols]);
  const cell = (c, r) => {
    const v = c.get ? c.get(r) : r[c.key];
    const out = c.fmt ? c.fmt(v, r) : (v ?? '—');
    const cls = [c.txt ? 'txt' : '', typeof c.cls === 'function' ? c.cls(v, r) : c.cls || ''].join(' ');
    return <td key={c.key} className={cls}>{out}</td>;
  };
  return (
    <div className="tbl-wrap" style={maxHeight ? { maxHeight, overflowY: 'auto' } : null}>
      <table className="tbl">
        <thead><tr>{cols.map((c) => (
          <th key={c.key} className={c.nosort ? '' : 'sortable'} style={c.txt ? { textAlign: 'left' } : null}
            onClick={() => !c.nosort && setSort((s) => ({ key: c.key, dir: s?.key === c.key ? -s.dir : -1 }))}>
            {c.label}{sort?.key === c.key ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}
          </th>))}</tr></thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={(r.symbol || r.id || '') + ':' + (r.date || '') + ':' + i} className={highlight && highlight(r) ? 'hl' : ''} onClick={onRowClick ? () => onRowClick(r) : undefined} style={onRowClick ? { cursor: 'pointer' } : null}>
              {cols.map((c) => cell(c, r))}
            </tr>
          ))}
          {footRows.map((r, i) => <tr key={'f' + i} className="avg">{cols.map((c) => cell(c, r))}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

// Tiny, safe Markdown renderer (headings, lists, tables, bold/italic, code, quotes).
function inline(s) {
  const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}
export function mdToHtml(md = '') {
  const lines = md.replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*\|/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const row = (x) => x.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
      const head = row(l); i += 2;
      const body = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { body.push(row(lines[i])); i++; }
      out.push(`<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    const h = l.match(/^(#{1,4})\s+(.*)/);
    if (h) { const n = Math.min(h[1].length + 1, 4); out.push(`<h${n}>${inline(h[2])}</h${n}>`); i++; continue; }
    if (/^\s*[-*•]\s+/.test(l)) {
      const items = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) { items.push(inline(lines[i].replace(/^\s*[-*•]\s+/, ''))); i++; }
      out.push(`<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>`); continue;
    }
    if (/^\s*\d+[.)]\s+/.test(l)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(inline(lines[i].replace(/^\s*\d+[.)]\s+/, ''))); i++; }
      out.push(`<ol>${items.map((x) => `<li>${x}</li>`).join('')}</ol>`); continue;
    }
    if (/^>\s?/.test(l)) { out.push(`<blockquote>${inline(l.replace(/^>\s?/, ''))}</blockquote>`); i++; continue; }
    if (/^---+$/.test(l.trim())) { out.push('<hr/>'); i++; continue; }
    if (!l.trim()) { i++; continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*[-*•]\s|\s*\d+[.)]\s|>|\s*\|)/.test(lines[i])) { para.push(inline(lines[i])); i++; }
    if (para.length) out.push(`<p>${para.join('<br/>')}</p>`); else i++;
  }
  return out.join('\n');
}
export const Markdown = ({ text }) => <div className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(text) }} />;

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const paths = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  compare: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />,
  xls: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M9 13l4 5M13 13l-4 5" /></>,
  spark: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  refresh: <><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></>,
};
export const Icon = ({ name, size = 16, filled }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...P} fill={filled ? 'currentColor' : 'none'}>{paths[name]}</svg>
);
