import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, ReferenceLine, PieChart, Pie, Cell,
} from 'recharts';
import { axisMoney, money, pct, mult, isNum } from '../lib/format.js';

export const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)'];
export const HEX = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#64748b'];

const fmtFor = (kind) => (kind === 'pct' ? (v) => pct(v) : kind === 'mult' ? (v) => mult(v) : kind === 'price' ? (v) => (isNum(v) ? `$${v.toFixed(2)}` : '—') : (v) => money(v));
const axisFor = (kind) => (kind === 'pct' ? (v) => `${Math.round(v * 100)}%` : kind === 'mult' ? (v) => `${v}x` : kind === 'price' ? (v) => `$${v}` : axisMoney);

function TT({ active, payload, label, kind }) {
  if (!active || !payload?.length) return null;
  const f = fmtFor(kind);
  return (
    <div className="tt">
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
          <span style={{ color: p.color }}>● {p.name}</span><span className="mono">{f(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// series: [{key, name, type: 'bar'|'line', kind?}]
export function MetricChart({ data, x = 'year', series, kind = 'money', height = 260, stacked = false, refY }) {
  if (!data?.length) return <div className="empty">No data</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={x} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={axisFor(kind)} tickLine={false} axisLine={false} width={52} />
        <Tooltip content={<TT kind={kind} />} cursor={{ fill: 'var(--panel-2)' }} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} />}
        {isNum(refY) && <ReferenceLine y={refY} stroke="var(--text-3)" strokeDasharray="4 4" />}
        {series.map((s, i) => s.type === 'line'
          ? <Line key={s.key} dataKey={s.key} name={s.name} stroke={HEX[i % 8]} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
          : <Bar key={s.key} dataKey={s.key} name={s.name} fill={HEX[i % 8]} radius={stacked ? 0 : [3, 3, 0, 0]} stackId={stacked ? 'a' : undefined} maxBarSize={38} />)}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function PriceChart({ data, height = 240 }) {
  if (!data?.length) return <div className="empty">No price history</div>;
  const up = data.at(-1).price >= data[0].price;
  const color = up ? '#0f9d58' : '#d93025';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.25} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={50} tickFormatter={(d) => d.slice(0, 7)} />
        <YAxis domain={['auto', 'auto']} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => `$${Math.round(v)}`} />
        <Tooltip content={<TT kind="price" />} />
        <Area dataKey="price" name="Price" stroke={color} fill="url(#pg)" strokeWidth={1.8} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Donut({ items, height = 220 }) {
  if (!items?.length) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={items} dataKey="revenue" nameKey="name" innerRadius="58%" outerRadius="88%" paddingAngle={1.5} stroke="none">
          {items.map((_, i) => <Cell key={i} fill={HEX[i % 8]} />)}
        </Pie>
        <Tooltip formatter={(v, n) => [money(v), n]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function HBar({ rows, valueKey, labelKey = 'symbol', kind = 'pct', height, highlight }) {
  const h = height || Math.max(140, rows.length * 30 + 20);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 30, left: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickFormatter={axisFor(kind)} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey={labelKey} width={64} tickLine={false} axisLine={false} />
        <Tooltip content={<TT kind={kind} />} cursor={{ fill: 'var(--panel-2)' }} />
        <Bar dataKey={valueKey} name={valueKey} radius={[0, 3, 3, 0]} maxBarSize={20}>
          {rows.map((r, i) => <Cell key={i} fill={highlight && highlight(r) ? '#2563eb' : '#94a3b8'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Lines({ data, keys, x = 'year', kind = 'pct', height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={x} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={axisFor(kind)} tickLine={false} axisLine={false} width={52} />
        <Tooltip content={<TT kind={kind} />} />
        <Legend iconType="circle" iconSize={8} />
        {keys.map((k, i) => <Line key={k.key || k} dataKey={k.key || k} name={k.name || k} stroke={HEX[i % 8]} strokeWidth={2} dot={false} connectNulls />)}
      </LineChart>
    </ResponsiveContainer>
  );
}
