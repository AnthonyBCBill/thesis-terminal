import { useState } from 'react';
import { Card, Seg } from '../../components/ui.jsx';
import { MetricChart } from '../../components/charts.jsx';
import { INCOME_FIELDS, BALANCE_FIELDS, CASH_FIELDS } from '../../lib/excel.js';
import { money, num, isNum } from '../../lib/format.js';

const BOLD = new Set(['revenue', 'grossProfit', 'operatingIncome', 'netIncome', 'totalAssets', 'totalDebt', 'totalStockholdersEquity', 'operatingCashFlow', 'freeCashFlow', 'epsDiluted']);
const PER_SHARE = new Set(['eps', 'epsDiluted']);
const COUNT = new Set(['weightedAverageShsOutDil']);

// Line items down, periods across — the fiscal.ai / Excel layout.
function Statement({ rows, fields, showGrowth }) {
  const cols = rows.map((r) => (r.period && r.period !== 'FY' ? `${r.period} '${String(r.fiscalYear || r.date).slice(2, 4)}` : `FY${r.fiscalYear || String(r.date).slice(0, 4)}`));
  const fmt = (k, v) => (PER_SHARE.has(k) ? num(v) : COUNT.has(k) ? (isNum(v) ? (v / 1e6).toFixed(0) + 'M' : '—') : money(v));
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th style={{ textAlign: 'left', minWidth: 200 }}>USD</th>{cols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
        <tbody>
          {fields.filter((f) => rows.some((r) => isNum(r[f.key]) && r[f.key] !== 0)).map((f) => (
            <FragmentRow key={f.key} f={f} rows={rows} fmt={fmt} showGrowth={showGrowth && BOLD.has(f.key)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
function FragmentRow({ f, rows, fmt, showGrowth }) {
  return (
    <>
      <tr className={BOLD.has(f.key) ? 'bold' : ''}><td>{f.label}</td>{rows.map((r, i) => <td key={i}>{fmt(f.key, r[f.key])}</td>)}</tr>
      {showGrowth && (
        <tr className="sub-row"><td>% growth</td>{rows.map((r, i) => {
          const p = rows[i - 1]?.[f.key], v = r[f.key];
          const g = isNum(p) && isNum(v) && p !== 0 ? (v - p) / Math.abs(p) : null;
          return <td key={i} className={g > 0 ? 'pos' : g < 0 ? 'neg' : ''} style={{ fontSize: 11.5 }}>{isNum(g) ? `${(g * 100).toFixed(1)}%` : ''}</td>;
        })}</tr>
      )}
    </>
  );
}

export default function Financials({ c, m }) {
  const [st, setSt] = useState('income');
  const [per, setPer] = useState('annual');
  const map = {
    income: { annual: c.incomeA, quarter: c.incomeQ, fields: INCOME_FIELDS },
    balance: { annual: c.balanceA, quarter: c.balanceQ, fields: BALANCE_FIELDS },
    cash: { annual: c.cashA, quarter: c.cashQ, fields: CASH_FIELDS },
  }[st];
  const rows = (per === 'annual' ? map.annual : map.quarter).slice(per === 'annual' ? -12 : -12);
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="grid g2">
        <Card title="Revenue & net income"><MetricChart data={m.history.slice(-12)} series={[{ key: 'revenue', name: 'Revenue', type: 'bar' }, { key: 'netIncome', name: 'Net income', type: 'bar' }]} /></Card>
        <Card title="EPS (diluted)"><MetricChart data={m.history.slice(-12)} series={[{ key: 'eps', name: 'EPS', type: 'bar' }]} kind="price" /></Card>
      </div>
      <Card title="Financial statements" right={
        <div className="row">
          <Seg value={st} onChange={setSt} options={[{ value: 'income', label: 'Income' }, { value: 'balance', label: 'Balance sheet' }, { value: 'cash', label: 'Cash flow' }]} />
          <Seg value={per} onChange={setPer} options={[{ value: 'annual', label: 'Annual' }, { value: 'quarter', label: 'Quarterly' }]} />
        </div>}>
        {rows.length ? <Statement rows={rows} fields={map.fields} showGrowth={st === 'income'} /> : <div className="empty">No data</div>}
      </Card>
    </div>
  );
}
