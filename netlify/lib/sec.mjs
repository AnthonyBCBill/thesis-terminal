// Free fallback data source: the SEC's XBRL "company facts" for any US filer.
// Converts reported 10-K / 10-Q facts into the same shape the app uses for FMP statements.
import { env } from './lib.mjs';

const UA = () => env('SEC_USER_AGENT') || 'ThesisResearch/1.0 (personal equity research tool)';

async function secJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA(), Accept: 'application/json' } });
  if (!r.ok) throw new Error(`SEC ${r.status} for ${url.split('/').pop()}`);
  return r.json();
}

export async function tickerToCik(store, symbol) {
  let map = await store.get('sec-tickers', { type: 'json' });
  if (!map || Date.now() - (map._t || 0) > 7 * 864e5) {
    const raw = await secJson('https://www.sec.gov/files/company_tickers.json');
    map = { _t: Date.now() };
    for (const v of Object.values(raw)) map[v.ticker.toUpperCase()] = { cik: v.cik_str, name: v.title };
    await store.setJSON('sec-tickers', map);
  }
  return map[symbol.toUpperCase()] || null;
}

// Tag priority lists (first tag with a value for a given period wins).
const DUR = {
  revenue: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueNet', 'RevenuesNetOfInterestExpense'],
  costOfRevenue: ['CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfGoodsSold', 'CostOfServices'],
  grossProfit: ['GrossProfit'],
  researchAndDevelopmentExpenses: ['ResearchAndDevelopmentExpense', 'ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost'],
  sellingAndMarketingExpenses: ['SellingAndMarketingExpense', 'MarketingExpense', 'AdvertisingExpense'],
  generalAndAdministrativeExpenses: ['GeneralAndAdministrativeExpense'],
  sellingGeneralAndAdministrativeExpenses: ['SellingGeneralAndAdministrativeExpense'],
  operatingIncome: ['OperatingIncomeLoss'],
  interestExpense: ['InterestExpense', 'InterestExpenseNonoperating', 'InterestExpenseDebt', 'InterestPaidNet'],
  incomeBeforeTax: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments'],
  incomeTaxExpense: ['IncomeTaxExpenseBenefit'],
  netIncome: ['NetIncomeLoss', 'ProfitLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic'],
  depreciationAndAmortization: ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'Depreciation'],
  operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
  capexPaid: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets', 'PaymentsForCapitalImprovements'],
  capSoftware: ['PaymentsToDevelopSoftware'],
  stockBasedCompensation: ['ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense'],
  buybacksPaid: ['PaymentsForRepurchaseOfCommonStock'],
  dividendsPaid: ['PaymentsOfDividendsCommonStock', 'PaymentsOfDividends'],
  acquisitionsPaid: ['PaymentsToAcquireBusinessesNetOfCashAcquired'],
};
const PER_SHARE = { eps: ['EarningsPerShareBasic'], epsDiluted: ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted'] };
const SHARES = { weightedAverageShsOutDil: ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfShareOutstandingBasicAndDiluted'] };
const INST = {
  cashAndCashEquivalents: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents', 'Cash'],
  shortTermInvestments: ['ShortTermInvestments', 'MarketableSecuritiesCurrent', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent', 'HeldToMaturitySecuritiesCurrent'],
  netReceivables: ['AccountsReceivableNetCurrent', 'ReceivablesNetCurrent'],
  inventory: ['InventoryNet'],
  totalCurrentAssets: ['AssetsCurrent'],
  propertyPlantEquipmentNet: ['PropertyPlantAndEquipmentNet', 'PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulatedDepreciationAndAmortization'],
  goodwill: ['Goodwill'],
  intangibleAssets: ['IntangibleAssetsNetExcludingGoodwill', 'FiniteLivedIntangibleAssetsNet'],
  totalAssets: ['Assets'],
  accountPayables: ['AccountsPayableCurrent'],
  debtCurrent: ['LongTermDebtCurrent', 'DebtCurrent', 'ConvertibleNotesPayableCurrent', 'LongTermDebtAndCapitalLeaseObligationsCurrent'],
  shortBorrowings: ['ShortTermBorrowings', 'CommercialPaper'],
  debtNoncurrent: ['LongTermDebtNoncurrent', 'ConvertibleNotesPayableNoncurrent', 'ConvertibleLongTermNotesPayable', 'LongTermDebtAndCapitalLeaseObligations', 'SeniorLongTermNotes'],
  debtTotalReported: ['LongTermDebt', 'DebtLongtermAndShorttermCombinedAmount', 'DebtInstrumentCarryingAmount'],
  leaseOperating: ['OperatingLeaseLiability'],
  leaseOperatingCurrent: ['OperatingLeaseLiabilityCurrent'],
  leaseFinance: ['FinanceLeaseLiability'],
  totalCurrentLiabilities: ['LiabilitiesCurrent'],
  totalLiabilities: ['Liabilities'],
  totalStockholdersEquity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
};

const days = (a, b) => (new Date(b) - new Date(a)) / 864e5;
const FORMS = /^(10-K|10-Q|20-F|40-F)(\/A)?$/;

// For each tag: { annual: {end: val}, quarter: {end: val}, ytd: {end: {start, val}}, instant: {end: val} }
function indexFacts(facts) {
  const gaap = facts?.facts?.['us-gaap'] || {};
  const idx = {};
  for (const [tag, def] of Object.entries(gaap)) {
    const units = def.units || {};
    const list = units.USD || units['USD/shares'] || units.shares || Object.values(units)[0] || [];
    const t = { annual: {}, quarter: {}, ytd: {}, instant: {} };
    for (const f of list) {
      if (!FORMS.test(f.form || '')) continue;
      const keep = (bucket, key, v) => { const old = bucket[key]; if (!old || f.filed > old.filed) bucket[key] = { ...v, filed: f.filed }; };
      if (f.start) {
        const d = days(f.start, f.end);
        if (d > 340 && d < 390) keep(t.annual, f.end, { val: f.val, start: f.start });
        else if (d > 75 && d < 105) keep(t.quarter, f.end, { val: f.val, start: f.start });
        else if (d > 160 && d < 290) keep(t.ytd, f.end, { val: f.val, start: f.start });
      } else keep(t.instant, f.end, { val: f.val });
    }
    idx[tag] = t;
  }
  return idx;
}

const getVal = (idx, tags, kind, end) => {
  for (const tag of tags) {
    const v = idx[tag]?.[kind]?.[end];
    if (v && Number.isFinite(v.val)) return v.val;
  }
  return null;
};
// Instant values can be dated a day or two off the period end in some filings.
const getInst = (idx, tags, end) => {
  const direct = getVal(idx, tags, 'instant', end);
  if (direct != null) return direct;
  for (const tag of tags) {
    const inst = idx[tag]?.instant || {};
    for (const k of Object.keys(inst)) if (Math.abs(days(k, end)) <= 4 && Number.isFinite(inst[k].val)) return inst[k].val;
  }
  return null;
};

function periodEnds(idx, kind) {
  const ends = new Set();
  for (const tag of [...DUR.revenue, ...DUR.netIncome, ...DUR.operatingCashFlow]) for (const e of Object.keys(idx[tag]?.[kind] || {})) ends.add(e);
  return [...ends].sort();
}

// Fiscal labels: quarter number from the company's fiscal-year-end month.
function monthOf(dateStr) { const d = new Date(dateStr + 'T12:00:00'); let m = d.getMonth() + 1, y = d.getFullYear(); if (d.getDate() < 15) { m -= 1; if (m === 0) { m = 12; y -= 1; } } return { m, y }; }

function buildRow(idx, kind, end, fyEndMonth) {
  const get = (tags) => getVal(idx, tags, kind, end);
  const row = { date: end, symbol: '', reportedCurrency: 'USD', source: 'SEC' };
  for (const [k, tags] of Object.entries(DUR)) row[k] = get(tags);
  for (const [k, tags] of Object.entries(PER_SHARE)) row[k] = get(tags);
  for (const [k, tags] of Object.entries(SHARES)) row[k] = get(tags);
  if (row.grossProfit == null && row.revenue != null && row.costOfRevenue != null) row.grossProfit = row.revenue - row.costOfRevenue;
  if (row.sellingGeneralAndAdministrativeExpenses == null && (row.sellingAndMarketingExpenses != null || row.generalAndAdministrativeExpenses != null)) row.sellingGeneralAndAdministrativeExpenses = (row.sellingAndMarketingExpenses || 0) + (row.generalAndAdministrativeExpenses || 0);
  row.ebitda = row.operatingIncome != null ? row.operatingIncome + (row.depreciationAndAmortization || 0) : null;
  const capex = (row.capexPaid || 0) + (row.capSoftware || 0);
  row.capitalExpenditure = row.capexPaid != null || row.capSoftware != null ? -capex : null;
  row.freeCashFlow = row.operatingCashFlow != null ? row.operatingCashFlow - capex : null;
  row.commonStockRepurchased = row.buybacksPaid != null ? -row.buybacksPaid : null;
  row.commonDividendsPaid = row.dividendsPaid != null ? -row.dividendsPaid : null;
  row.acquisitionsNet = row.acquisitionsPaid != null ? -row.acquisitionsPaid : null;
  // Balance sheet at period end
  for (const [k, tags] of Object.entries(INST)) row[k] = getInst(idx, tags, end);
  row.cashAndShortTermInvestments = row.cashAndCashEquivalents != null ? row.cashAndCashEquivalents + (row.shortTermInvestments || 0) : null;
  row.shortTermDebt = row.debtCurrent != null || row.shortBorrowings != null ? (row.debtCurrent || 0) + (row.shortBorrowings || 0) : null;
  row.longTermDebt = row.debtNoncurrent ?? (row.debtTotalReported != null ? row.debtTotalReported - (row.debtCurrent || 0) : null);
  row.totalDebt = row.shortTermDebt != null || row.longTermDebt != null ? (row.shortTermDebt || 0) + (row.longTermDebt || 0) : null;
  row.capitalLeaseObligations = row.leaseOperating != null || row.leaseFinance != null ? (row.leaseOperating || 0) + (row.leaseFinance || 0) : null;
  row.capitalLeaseObligationsCurrent = row.leaseOperatingCurrent;
  row.netDebt = row.totalDebt != null && row.cashAndShortTermInvestments != null ? row.totalDebt - row.cashAndShortTermInvestments : null;
  row.netCashProvidedByOperatingActivities = row.operatingCashFlow;
  // Labels
  const { m, y } = monthOf(end);
  if (kind === 'annual') { row.period = 'FY'; row.fiscalYear = String(y); }
  else {
    const q = ((m - fyEndMonth + 12) % 12) / 3;
    const qn = Math.round(q) === 0 ? 4 : Math.round(q);
    row.period = `Q${qn}`;
    row.fiscalYear = String(m <= fyEndMonth ? y : y + 1);
  }
  return row;
}

// Cash-flow lines in 10-Qs are year-to-date (6 or 9 months). Turn them into single quarters:
// Q2 = 6-month YTD - Q1, Q3 = 9-month YTD - 6-month YTD.
function deriveFromYtd(idx) {
  for (const t of Object.values(idx)) {
    const ytd = Object.entries(t.ytd).sort(([a], [b]) => a.localeCompare(b));
    for (const [end, y] of ytd) {
      if (t.quarter[end]) continue;
      // Prior cumulative value with the same fiscal-year start, ending ~3 months earlier.
      const prevYtd = ytd.find(([e, v]) => v.start === y.start && days(e, end) > 75 && days(e, end) < 105);
      const prevQ = Object.entries(t.quarter).find(([e, v]) => v.start === y.start && days(e, end) > 75 && days(e, end) < 105);
      const prev = prevYtd?.[1] || prevQ?.[1];
      if (prev && Number.isFinite(prev.val)) t.quarter[end] = { val: y.val - prev.val, start: null, filed: y.filed, derived: true };
    }
  }
}

// Q4 is rarely filed on its own: derive it as full year minus the first nine months.
function deriveQ4(idx, annualEnds, quarterEnds) {
  const derived = {};
  for (const fy of annualEnds) {
    const q3 = quarterEnds.filter((e) => days(e, fy) > 75 && days(e, fy) < 105)[0];
    if (quarterEnds.includes(fy)) continue;
    for (const [, tags] of Object.entries({ ...DUR, ...PER_SHARE })) {
      for (const tag of tags) {
        const a = idx[tag]?.annual?.[fy];
        const ytd9 = q3 ? idx[tag]?.ytd?.[q3] : null; // nine-month YTD ending at Q3
        if (a && ytd9 && days(ytd9.start, q3) > 250) {
          idx[tag].quarter[fy] = { val: a.val - ytd9.val, filed: a.filed, derived: true };
          derived[fy] = true;
        }
      }
    }
  }
  return derived;
}

export async function secStatements(store, symbol) {
  const hit = await tickerToCik(store, symbol);
  if (!hit) return { error: `${symbol} not found in SEC filings` };
  const cik = String(hit.cik).padStart(10, '0');
  const facts = await secJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);
  const idx = indexFacts(facts);
  const annualEnds = periodEnds(idx, 'annual');
  deriveFromYtd(idx);
  let quarterEnds = periodEnds(idx, 'quarter');
  deriveQ4(idx, annualEnds, quarterEnds);
  quarterEnds = periodEnds(idx, 'quarter');
  const fyEndMonth = annualEnds.length ? monthOf(annualEnds.at(-1)).m : 12;
  const annual = annualEnds.slice(-15).map((e) => buildRow(idx, 'annual', e, fyEndMonth)).filter((r) => r.revenue != null || r.netIncome != null);
  const quarter = quarterEnds.slice(-16).map((e) => buildRow(idx, 'quarter', e, fyEndMonth)).filter((r) => r.revenue != null || r.netIncome != null);
  for (const r of [...annual, ...quarter]) r.symbol = symbol.toUpperCase();
  return { symbol: symbol.toUpperCase(), cik, name: hit.name, annual: annual.reverse(), quarter: quarter.reverse() };
}
