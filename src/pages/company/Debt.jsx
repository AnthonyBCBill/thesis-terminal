import { Card, Stat, DataTable } from '../../components/ui.jsx';
import { MetricChart } from '../../components/charts.jsx';
import { money, mult, num, pct, isNum, lev } from '../../lib/format.js';

export default function Debt({ c, m, peerRows }) {
  const bs = c.balanceQ.at(-1) || {};
  const quarters = c.balanceQ.map((r) => ({
    q: `${r.period || ''} ${String(r.fiscalYear || r.date).slice(0, 4)}`,
    debt: r.totalDebt, cash: r.cashAndShortTermInvestments ?? r.cashAndCashEquivalents,
  }));
  const gradeCls = { Strong: 'pos', Moderate: 'warn', Elevated: 'warn', High: 'neg' }[m.debtRating.grade] || '';
  const obligations = [
    { item: 'Short-term debt (due ≤ 1 yr)', v: m.shortTermDebt },
    { item: 'Long-term debt', v: m.longTermDebt },
    { item: 'Lease obligations — total', v: m.leases },
    { item: 'Lease obligations — current', v: m.leasesCurrent },
    { item: 'Total debt (reported)', v: m.totalDebt },
    { item: 'Accounts payable', v: bs.accountPayables },
    { item: 'Total current liabilities', v: bs.totalCurrentLiabilities },
    { item: 'Total liabilities', v: bs.totalLiabilities },
  ];
  const peers = [...peerRows, { symbol: c.symbol, netDebt: m.netDebt, netDebtToEbitda: m.netDebtToEbitda, interestCoverage: m.interestCoverage, marketCap: m.marketCap }];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="stats">
        <Stat label="Total debt" value={money(m.totalDebt)} sub={`ST ${money(m.shortTermDebt)} · LT ${money(m.longTermDebt)}`} />
        <Stat label="Total cash" value={money(m.cash)} sub="Cash + short-term investments" />
        <Stat label={m.netDebt > 0 ? 'Net debt' : 'Net cash'} value={money(Math.abs(m.netDebt ?? NaN))} cls={m.netDebt > 0 ? '' : 'pos'} />
        <Stat label="Financing obligations" value={money(m.leases)} sub="Lease liabilities" />
        <Stat label="Debt grade" value={m.debtRating.grade} cls={gradeCls} sub={m.debtRating.note} />
      </div>
      <Card title="Ability to service the debt">
        <div className="stats">
          <Stat label="Net debt / EBITDA" value={lev(m.netDebtToEbitda)} sub="< 2x comfortable, > 4x heavy" />
          <Stat label="Debt / EBITDA" value={mult(m.debtToEbitda)} />
          <Stat label="Interest coverage" value={mult(m.interestCoverage)} sub="EBIT ÷ interest; > 6x strong" cls={m.interestCoverage > 6 ? 'pos' : m.interestCoverage < 2 ? 'neg' : ''} />
          <Stat label="FCF / total debt" value={pct(m.fcfToDebt)} sub="Share of debt FCF repays per year" />
          <Stat label="Years to repay net debt" value={isNum(m.yearsToRepay) ? m.yearsToRepay.toFixed(1) : '—'} sub="Net debt ÷ TTM FCF" />
          <Stat label="Current ratio" value={num(m.currentRatio)} sub="Current assets ÷ current liabilities" />
          <Stat label="Debt / equity" value={mult(m.debtToEquity)} />
          <Stat label="Cash covers ST debt?" value={m.cashCoversShortTerm == null ? '—' : m.cashCoversShortTerm ? 'Yes' : 'No'} cls={m.cashCoversShortTerm ? 'pos' : 'neg'} />
          <Stat label="Altman Z-score" value={num(m.altmanZ)} sub="> 3 safe · < 1.8 distress" cls={m.altmanZ > 3 ? 'pos' : m.altmanZ < 1.8 ? 'neg' : ''} />
          <Stat label="Piotroski F-score" value={m.piotroski ?? '—'} sub="0–9, higher = healthier" />
          <Stat label="TTM interest expense" value={money(m.ttm.interestExpense)} />
        </div>
      </Card>
      <div className="grid g2">
        <Card title="Debt vs cash — quarterly"><MetricChart data={quarters} x="q" series={[{ key: 'debt', name: 'Total debt', type: 'bar' }, { key: 'cash', name: 'Cash & ST inv.', type: 'bar' }]} /></Card>
        <Card title="Debt vs cash — annual"><MetricChart data={m.history.slice(-10)} series={[{ key: 'totalDebt', name: 'Total debt', type: 'bar' }, { key: 'cash', name: 'Cash & ST inv.', type: 'bar' }]} /></Card>
      </div>
      <div className="grid g2">
        <Card title="Obligations (latest quarter)">
          <DataTable rows={obligations} cols={[{ key: 'item', label: 'Item', txt: true, nosort: true }, { key: 'v', label: 'Amount', fmt: money, nosort: true }]} />
          <div className="sub" style={{ marginTop: 8 }}>Detailed debt maturity schedules are in the 10-K notes; the AI memo summarizes them when available.</div>
        </Card>
        <Card title="Leverage vs peers">
          <DataTable rows={peers} highlight={(r) => r.symbol === c.symbol} initialSort={{ key: 'netDebtToEbitda', dir: 1 }} cols={[
            { key: 'symbol', label: 'Ticker' }, { key: 'netDebt', label: 'Net debt', fmt: money },
            { key: 'netDebtToEbitda', label: 'Net debt/EBITDA', fmt: lev }, { key: 'interestCoverage', label: 'Int. coverage', fmt: mult },
          ]} />
        </Card>
      </div>
    </div>
  );
}
