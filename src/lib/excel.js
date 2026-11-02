// Excel export — one workbook per company with every table, laid out like a classic model.
import * as XLSX from 'xlsx';

function sheetFromRows(rows, cols) {
  const header = cols.map((c) => c.label);
  const body = rows.map((r) => cols.map((c) => (typeof c.get === 'function' ? c.get(r) : r[c.key]) ?? null));
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  ws['!cols'] = cols.map((c) => ({ wch: c.w || 14 }));
  return ws;
}

// Statements transposed: line items down, years across (like Excel models / fiscal.ai).
function statementSheet(rows, fields) {
  const years = rows.map((r) => String(r.fiscalYear || r.calendarYear || String(r.date).slice(0, 4)) + (r.period && r.period !== 'FY' ? ` ${r.period}` : ''));
  const aoa = [['Line item', ...years]];
  for (const f of fields) aoa.push([f.label, ...rows.map((r) => r[f.key] ?? null)]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 38 }, ...years.map(() => ({ wch: 16 }))];
  return ws;
}

export const INCOME_FIELDS = [
  ['revenue', 'Revenue'], ['costOfRevenue', 'Cost of revenue'], ['grossProfit', 'Gross profit'],
  ['researchAndDevelopmentExpenses', 'R&D'], ['sellingAndMarketingExpenses', 'Sales & marketing'],
  ['generalAndAdministrativeExpenses', 'G&A'], ['sellingGeneralAndAdministrativeExpenses', 'SG&A'],
  ['operatingExpenses', 'Operating expenses'], ['operatingIncome', 'Operating income'], ['interestExpense', 'Interest expense'],
  ['ebitda', 'EBITDA'], ['incomeBeforeTax', 'Pre-tax income'], ['incomeTaxExpense', 'Income tax'], ['netIncome', 'Net income'],
  ['eps', 'EPS (basic)'], ['epsDiluted', 'EPS (diluted)'], ['weightedAverageShsOutDil', 'Diluted shares'],
].map(([key, label]) => ({ key, label }));
export const BALANCE_FIELDS = [
  ['cashAndCashEquivalents', 'Cash & equivalents'], ['shortTermInvestments', 'Short-term investments'], ['cashAndShortTermInvestments', 'Cash & ST investments'],
  ['netReceivables', 'Receivables'], ['inventory', 'Inventory'], ['totalCurrentAssets', 'Total current assets'],
  ['propertyPlantEquipmentNet', 'PP&E (net)'], ['goodwill', 'Goodwill'], ['intangibleAssets', 'Intangibles'], ['totalAssets', 'Total assets'],
  ['accountPayables', 'Accounts payable'], ['shortTermDebt', 'Short-term debt'], ['totalCurrentLiabilities', 'Total current liabilities'],
  ['longTermDebt', 'Long-term debt'], ['capitalLeaseObligations', 'Lease obligations'], ['totalDebt', 'Total debt'], ['netDebt', 'Net debt'],
  ['totalLiabilities', 'Total liabilities'], ['totalStockholdersEquity', "Shareholders' equity"],
].map(([key, label]) => ({ key, label }));
export const CASH_FIELDS = [
  ['netIncome', 'Net income'], ['depreciationAndAmortization', 'D&A'], ['stockBasedCompensation', 'Stock-based comp'],
  ['changeInWorkingCapital', 'Change in working capital'], ['operatingCashFlow', 'Operating cash flow'],
  ['capitalExpenditure', 'Capex'], ['freeCashFlow', 'Free cash flow'], ['acquisitionsNet', 'Acquisitions'],
  ['commonStockRepurchased', 'Buybacks'], ['commonDividendsPaid', 'Dividends'], ['netDebtIssuance', 'Net debt issuance'],
].map(([key, label]) => ({ key, label }));

export function exportCompany(c, peerRows = [], avgs = null) {
  const m = c.m;
  const wb = XLSX.utils.book_new();
  const summary = [
    ['Thesis export', `${m.name} (${c.symbol})`], ['Generated', new Date().toLocaleString()], [],
    ['Price', m.price], ['Market cap', m.marketCap], ['Enterprise value', m.ev],
    ['Trailing P/E', m.trailingPE], ['Forward P/E (next FY)', m.forwardPE], ['Forward P/E (FY+2)', m.forwardPE2], ['PEG', m.peg],
    ['EV/EBITDA', m.evEbitda], ['P/S', m.ps], ['P/FCF', m.pfcf], ['FCF yield', m.fcfYield], ['5y avg P/E', m.pe5yAvg],
    [], ['TTM revenue', m.ttm.revenue], ['Gross margin', m.margins.gross], ['Operating margin', m.margins.operating],
    ['Net margin', m.margins.net], ['FCF margin', m.margins.fcf], ['TTM FCF', m.ttm.fcf],
    [], ['Total cash', m.cash], ['Total debt', m.totalDebt], ['Lease obligations', m.leases], ['Net debt', m.netDebt],
    ['Net debt / EBITDA', m.netDebtToEbitda], ['Interest coverage', m.interestCoverage], ['Current ratio', m.currentRatio],
    ['Altman Z', m.altmanZ], ['Piotroski', m.piotroski],
    [], ['Next FY revenue growth (consensus)', m.revGrowthNext], ['Next FY EPS growth (consensus)', m.epsGrowthNext],
    ['Revenue CAGR 5y', m.revCagr5], ['EPS CAGR 5y', m.epsCagr5],
  ];
  const ws = XLSX.utils.aoa_to_sheet(summary); ws['!cols'] = [{ wch: 34 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  if (c.incomeA.length) XLSX.utils.book_append_sheet(wb, statementSheet(c.incomeA, INCOME_FIELDS), 'Income (annual)');
  if (c.incomeQ.length) XLSX.utils.book_append_sheet(wb, statementSheet(c.incomeQ, INCOME_FIELDS), 'Income (quarterly)');
  if (c.balanceA.length) XLSX.utils.book_append_sheet(wb, statementSheet(c.balanceA, BALANCE_FIELDS), 'Balance sheet');
  if (c.cashA.length) XLSX.utils.book_append_sheet(wb, statementSheet(c.cashA, CASH_FIELDS), 'Cash flow');
  XLSX.utils.book_append_sheet(wb, sheetFromRows(m.history, [
    { key: 'year', label: 'Year', w: 8 }, { key: 'revenue', label: 'Revenue' }, { key: 'revGrowth', label: 'Rev growth' },
    { key: 'gross', label: 'Gross margin' }, { key: 'operating', label: 'Operating margin' }, { key: 'net', label: 'Net margin' },
    { key: 'fcfMargin', label: 'FCF margin' }, { key: 'marketingPct', label: 'S&M % rev' }, { key: 'rndPct', label: 'R&D % rev' },
  ]), 'Margins');
  if (m.segments) XLSX.utils.book_append_sheet(wb, sheetFromRows(m.segments.items, [
    { key: 'name', label: 'Segment', w: 30 }, { key: 'revenue', label: 'Revenue' }, { key: 'share', label: '% of revenue' },
    { key: 'yoy', label: 'YoY growth' }, { key: 'cagr3', label: '3y CAGR' },
  ]), 'Segments');
  if (c.estimates.length) XLSX.utils.book_append_sheet(wb, sheetFromRows(c.estimates, [
    { key: 'year', label: 'FY', w: 8 }, { key: 'revenue', label: 'Revenue est' }, { key: 'eps', label: 'EPS est' },
    { key: 'epsLow', label: 'EPS low' }, { key: 'epsHigh', label: 'EPS high' }, { key: 'ebitda', label: 'EBITDA est' }, { key: 'analysts', label: '# analysts' },
  ]), 'Estimates');
  if (peerRows.length) {
    const rows = avgs ? [...peerRows, { symbol: 'PEER AVG', ...avgs.avg }, { symbol: 'PEER MEDIAN', ...avgs.med }] : peerRows;
    XLSX.utils.book_append_sheet(wb, sheetFromRows(rows, PEER_COLS), 'Peers');
  }
  XLSX.writeFile(wb, `${c.symbol}_thesis_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export const PEER_COLS = [
  { key: 'symbol', label: 'Ticker', w: 12 }, { key: 'name', label: 'Name', w: 28 }, { key: 'marketCap', label: 'Market cap' },
  { key: 'trailingPE', label: 'Trailing P/E' }, { key: 'forwardPE', label: 'Forward P/E' }, { key: 'forwardPE2', label: 'FY+2 P/E' },
  { key: 'peg', label: 'PEG' }, { key: 'evEbitda', label: 'EV/EBITDA' }, { key: 'ps', label: 'P/S' }, { key: 'pfcf', label: 'P/FCF' },
  { key: 'gross', label: 'Gross margin' }, { key: 'operating', label: 'Op margin' }, { key: 'net', label: 'Net margin' },
  { key: 'fcfMargin', label: 'FCF margin' }, { key: 'revGrowthNext', label: 'Rev growth (next FY)' }, { key: 'epsGrowthNext', label: 'EPS growth (next FY)' },
  { key: 'netDebtToEbitda', label: 'Net debt/EBITDA' }, { key: 'interestCoverage', label: 'Interest cover' }, { key: 'roic', label: 'ROIC' },
];

export function exportRows(rows, cols, name) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromRows(rows, cols), name.slice(0, 30));
  XLSX.writeFile(wb, `${name.replace(/\W+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
