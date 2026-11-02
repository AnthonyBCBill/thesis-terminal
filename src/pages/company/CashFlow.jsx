import { Card, Stat, DataTable } from '../../components/ui.jsx';
import { MetricChart } from '../../components/charts.jsx';
import { money, pct, num, isNum } from '../../lib/format.js';

export default function CashFlow({ m }) {
  const t = m.ttm;
  const hist = m.history.map((h) => ({ ...h, capexPos: isNum(h.capex) ? Math.abs(h.capex) : null, buybacksPos: isNum(h.buybacks) ? Math.abs(h.buybacks) : null, dividendsPos: isNum(h.dividends) ? Math.abs(h.dividends) : null, conversion: isNum(h.fcf) && h.netIncome > 0 ? h.fcf / h.netIncome : null }));
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="stats">
        <Stat label="Operating cash flow (TTM)" value={money(t.ocf)} />
        <Stat label="Capex (TTM)" value={money(t.capex)} sub={`${pct(Math.abs(t.capex) / t.revenue)} of revenue`} />
        <Stat label="Free cash flow (TTM)" value={money(t.fcf)} cls={t.fcf > 0 ? 'pos' : 'neg'} />
        <Stat label="FCF margin" value={pct(m.margins.fcf)} />
        <Stat label="FCF / net income" value={num(t.fcf / t.netIncome)} sub="> 1 = high-quality earnings" />
        <Stat label="FCF yield" value={pct(m.fcfYield)} />
        <Stat label="Stock-based comp" value={money(t.sbc)} sub={`${pct(t.sbc / t.revenue)} of rev · ${pct(t.sbc / t.fcf)} of FCF`} />
        <Stat label="Buybacks (TTM)" value={money(isNum(t.buybacks) ? Math.abs(t.buybacks) : null)} />
        <Stat label="Dividends (TTM)" value={money(isNum(t.dividends) ? Math.abs(t.dividends) : null)} />
        <Stat label="FCF CAGR 5y" value={pct(m.fcfCagr5)} />
      </div>
      <div className="grid g2">
        <Card title="Operating CF, capex and FCF"><MetricChart data={hist.slice(-12)} series={[{ key: 'ocf', name: 'Operating CF', type: 'bar' }, { key: 'capexPos', name: 'Capex', type: 'bar' }, { key: 'fcf', name: 'FCF', type: 'line' }]} /></Card>
        <Card title="Capital returned to shareholders"><MetricChart data={hist.slice(-12)} series={[{ key: 'buybacksPos', name: 'Buybacks', type: 'bar' }, { key: 'dividendsPos', name: 'Dividends', type: 'bar' }, { key: 'fcf', name: 'FCF', type: 'line' }]} stacked /></Card>
      </div>
      <Card title="Cash flow by year">
        <DataTable rows={[...hist].reverse()} cols={[
          { key: 'year', label: 'FY', txt: true }, { key: 'ocf', label: 'Operating CF', fmt: money }, { key: 'capex', label: 'Capex', fmt: money },
          { key: 'fcf', label: 'FCF', fmt: money }, { key: 'fcfMargin', label: 'FCF margin', fmt: pct }, { key: 'conversion', label: 'FCF/NI', fmt: (v) => num(v) },
          { key: 'sbc', label: 'SBC', fmt: money }, { key: 'buybacks', label: 'Buybacks', fmt: money }, { key: 'dividends', label: 'Dividends', fmt: money },
        ]} />
      </Card>
    </div>
  );
}
