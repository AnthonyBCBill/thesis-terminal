// Loads everything about a company and computes the metrics behind each checklist item.
import { fmpSafe, isEco } from './api.js';
import { isNum } from './format.js';

export const pick = (o, ...keys) => {
  if (!o) return undefined;
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};
const arr = (x) => (Array.isArray(x) ? x : []);
const first = (x) => arr(x)[0] || null;
const sum = (xs) => (xs.length && xs.every(isNum) ? xs.reduce((a, b) => a + b, 0) : null);
const div = (a, b) => (isNum(a) && isNum(b) && b !== 0 ? a / b : null);
export const mean = (xs) => { const v = xs.filter(isNum); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
export const median = (xs) => {
  const v = xs.filter(isNum).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const stdev = (xs) => {
  const v = xs.filter(isNum); if (v.length < 2) return null;
  const m = mean(v); return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
};
const cagr = (start, end, years) => (isNum(start) && isNum(end) && start > 0 && end > 0 && years > 0 ? (end / start) ** (1 / years) - 1 : null);
const slope = (ys) => { // simple linear regression slope per period
  const pts = ys.map((y, i) => [i, y]).filter(([, y]) => isNum(y));
  if (pts.length < 3) return null;
  const n = pts.length, mx = mean(pts.map((p) => p[0])), my = mean(pts.map((p) => p[1]));
  const num = pts.reduce((a, [x, y]) => a + (x - mx) * (y - my), 0);
  const den = pts.reduce((a, [x]) => a + (x - mx) ** 2, 0);
  return den ? num / den : null;
};
const asc = (rows) => [...arr(rows)].sort((a, b) => String(a.date).localeCompare(String(b.date)));
const yearOf = (r) => String(pick(r, 'fiscalYear', 'calendarYear') || String(r.date || '').slice(0, 4));

// ---------- normalizers (tolerate both FMP "stable" and legacy shapes) ----------
export function normalizeSegments(raw) {
  const out = [];
  for (const r of arr(raw)) {
    if (r && r.data && typeof r.data === 'object') {
      out.push({ year: String(r.fiscalYear || String(r.date).slice(0, 4)), date: r.date, data: r.data });
    } else if (r && typeof r === 'object') {
      for (const [date, data] of Object.entries(r)) {
        if (data && typeof data === 'object') out.push({ year: date.slice(0, 4), date, data });
      }
    }
  }
  return out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function normalizePeers(raw, self) {
  const list = [];
  for (const r of arr(raw)) {
    if (Array.isArray(r.peersList)) list.push(...r.peersList);
    else if (r.symbol) list.push(r.symbol);
  }
  // US listings only (foreign tickers like 002241.SZ aren't on most plans and aren't comparable).
  return [...new Set(list)].filter((s) => s && s !== self && /^[A-Z]{1,5}$/.test(s) && !/^[A-Z]{4}[FY]$/.test(s)).slice(0, 10); // drop OTC foreign lines (e.g. SSNLF, XIACF)
}

export function normalizeEstimates(raw) {
  return asc(raw).map((e) => ({
    date: e.date,
    year: yearOf(e),
    revenue: pick(e, 'revenueAvg', 'estimatedRevenueAvg'),
    revenueLow: pick(e, 'revenueLow', 'estimatedRevenueLow'),
    revenueHigh: pick(e, 'revenueHigh', 'estimatedRevenueHigh'),
    eps: pick(e, 'epsAvg', 'estimatedEpsAvg'),
    epsLow: pick(e, 'epsLow', 'estimatedEpsLow'),
    epsHigh: pick(e, 'epsHigh', 'estimatedEpsHigh'),
    ebitda: pick(e, 'ebitdaAvg', 'estimatedEbitdaAvg'),
    netIncome: pick(e, 'netIncomeAvg', 'estimatedNetIncomeAvg'),
    analysts: pick(e, 'numAnalystsEps', 'numberAnalystsEstimatedEps', 'numAnalystsRevenue'),
  }));
}

// ---------- loading ----------
export async function loadCompany(symbol, { lite = false } = {}) {
  const s = symbol.toUpperCase();
  const P = { symbol: s };
  const calls = {
    // Price, market cap and day change come from the profile — no separate quote request.
    profile: fmpSafe('profile', P),
    incomeA: fmpSafe('income-statement', { ...P, period: 'annual', limit: lite ? 5 : 15 }),
    incomeQ: fmpSafe('income-statement', { ...P, period: 'quarter', limit: lite ? 4 : 16 }),
    balanceQ: fmpSafe('balance-sheet-statement', { ...P, period: 'quarter', limit: lite ? 1 : 8 }),
    cashQ: fmpSafe('cash-flow-statement', { ...P, period: 'quarter', limit: lite ? 4 : 16 }),
    estimates: fmpSafe('analyst-estimates', { ...P, period: 'annual', limit: 10 }),
  };
  if (!lite || !isEco()) calls.metricsTTM = fmpSafe('key-metrics-ttm', P);
  if (!lite) Object.assign(calls, {
    balanceA: fmpSafe('balance-sheet-statement', { ...P, period: 'annual', limit: 15 }),
    cashA: fmpSafe('cash-flow-statement', { ...P, period: 'annual', limit: 15 }),
    ratiosA: fmpSafe('ratios', { ...P, period: 'annual', limit: 15 }),
    scores: fmpSafe('financial-scores', P),
    peersRaw: fmpSafe('stock-peers', P),
    segProduct: fmpSafe('revenue-product-segmentation', { ...P, period: 'annual', structure: 'flat' }),
    segGeo: fmpSafe('revenue-geographic-segmentation', { ...P, period: 'annual', structure: 'flat' }),
    priceTarget: fmpSafe('price-target-consensus', P),
    grades: fmpSafe('grades-consensus', P),
    earnings: fmpSafe('earnings', { ...P, limit: 24 }),
    prices: fmpSafe('historical-price-eod/light', { ...P, from: new Date(Date.now() - 5 * 365 * 864e5).toISOString().slice(0, 10) }),
  });
  const keys = Object.keys(calls);
  const results = await Promise.all(Object.values(calls));
  const raw = {}; const errors = {};
  keys.forEach((k, i) => { raw[k] = results[i].data; if (results[i].error) errors[k] = results[i].error; });

  const c = {
    symbol: s,
    lite,
    errors,
    profile: first(raw.profile) || {},
    quote: {},
    incomeA: asc(raw.incomeA), incomeQ: asc(raw.incomeQ),
    balanceA: asc(raw.balanceA), balanceQ: asc(raw.balanceQ),
    cashA: asc(raw.cashA), cashQ: asc(raw.cashQ),
    ratiosA: asc(raw.ratiosA),
    metricsTTM: first(raw.metricsTTM) || {},
    scores: first(raw.scores) || {},
    estimates: normalizeEstimates(raw.estimates),
    peers: normalizePeers(raw.peersRaw, s),
    segProduct: normalizeSegments(raw.segProduct),
    segGeo: normalizeSegments(raw.segGeo),
    priceTarget: first(raw.priceTarget) || {},
    grades: first(raw.grades) || {},
    earnings: asc(raw.earnings),
    prices: asc(raw.prices).map((p) => ({ date: p.date, price: pick(p, 'price', 'close') })),
  };
  c.m = computeMetrics(c);
  return c;
}

// ---------- metrics ----------
export function computeMetrics(c) {
  const m = {};
  const today = new Date().toISOString().slice(0, 10);
  const q4 = c.incomeQ.slice(-4), cq4 = c.cashQ.slice(-4);
  const lastBS = c.balanceQ.at(-1) || c.balanceA.at(-1) || {};
  const lastA = c.incomeA.at(-1) || {};

  m.price = pick(c.quote, 'price') ?? pick(c.profile, 'price');
  m.marketCap = pick(c.quote, 'marketCap') ?? pick(c.profile, 'marketCap', 'mktCap');
  m.changePct = pick(c.quote, 'changePercentage', 'changesPercentage') ?? pick(c.profile, 'changePercentage', 'changesPercentage');
  m.name = pick(c.profile, 'companyName') || c.symbol;
  m.sector = c.profile.sector; m.industry = c.profile.industry;

  // TTM (sum of last 4 quarters; fall back to last fiscal year)
  const ttm = (rows, ...k) => (rows.length === 4 ? sum(rows.map((r) => pick(r, ...k))) : null);
  m.ttm = {
    revenue: ttm(q4, 'revenue') ?? lastA.revenue,
    grossProfit: ttm(q4, 'grossProfit') ?? lastA.grossProfit,
    operatingIncome: ttm(q4, 'operatingIncome') ?? lastA.operatingIncome,
    netIncome: ttm(q4, 'netIncome') ?? lastA.netIncome,
    ebitda: ttm(q4, 'ebitda') ?? lastA.ebitda,
    eps: ttm(q4, 'epsDiluted', 'epsdiluted', 'eps') ?? pick(lastA, 'epsDiluted', 'epsdiluted', 'eps'),
    interestExpense: ttm(q4, 'interestExpense') ?? lastA.interestExpense,
    sga: ttm(q4, 'sellingGeneralAndAdministrativeExpenses'),
    marketing: ttm(q4, 'sellingAndMarketingExpenses'),
    rnd: ttm(q4, 'researchAndDevelopmentExpenses'),
    ocf: ttm(cq4, 'operatingCashFlow', 'netCashProvidedByOperatingActivities'),
    capex: ttm(cq4, 'capitalExpenditure'),
    fcf: ttm(cq4, 'freeCashFlow'),
    sbc: ttm(cq4, 'stockBasedCompensation'),
    buybacks: ttm(cq4, 'commonStockRepurchased'),
    dividends: ttm(cq4, 'commonDividendsPaid', 'netDividendsPaid', 'dividendsPaid'),
  };
  const t = m.ttm;
  m.margins = {
    gross: div(t.grossProfit, t.revenue),
    operating: div(t.operatingIncome, t.revenue),
    net: div(t.netIncome, t.revenue),
    ebitda: div(t.ebitda, t.revenue),
    fcf: div(t.fcf, t.revenue),
  };

  // Valuation
  m.trailingPE = !isNum(t.eps) || !isNum(m.price) ? null : t.eps > 0 ? m.price / t.eps : -1; // -1 renders as "NM"
  const future = c.estimates.filter((e) => e.date > today && isNum(e.eps));
  m.estNext = future[0] || null; m.estNext2 = future[1] || null;
  m.forwardPE = m.estNext && m.estNext.eps > 0 ? m.price / m.estNext.eps : null;
  m.forwardPE2 = m.estNext2 && m.estNext2.eps > 0 ? m.price / m.estNext2.eps : null;
  const lastFYeps = pick(lastA, 'epsDiluted', 'epsdiluted', 'eps');
  m.epsGrowthNext = m.estNext ? div(m.estNext.eps - lastFYeps, Math.abs(lastFYeps)) : null;
  m.epsGrowthNext2 = m.estNext && m.estNext2 ? div(m.estNext2.eps - m.estNext.eps, Math.abs(m.estNext.eps)) : null;
  m.revGrowthNext = m.estNext ? div(m.estNext.revenue - lastA.revenue, lastA.revenue) : null;
  m.revGrowthNext2 = m.estNext && m.estNext2 ? div(m.estNext2.revenue - m.estNext.revenue, m.estNext.revenue) : null;
  m.peg = m.forwardPE && m.epsGrowthNext > 0 ? m.forwardPE / (m.epsGrowthNext * 100) : null;

  m.cash = pick(lastBS, 'cashAndShortTermInvestments', 'cashAndCashEquivalents');
  m.totalDebt = pick(lastBS, 'totalDebt') ?? sum([lastBS.shortTermDebt || 0, lastBS.longTermDebt || 0]);
  m.shortTermDebt = lastBS.shortTermDebt; m.longTermDebt = lastBS.longTermDebt;
  m.leases = pick(lastBS, 'capitalLeaseObligations');
  m.leasesCurrent = pick(lastBS, 'capitalLeaseObligationsCurrent');
  m.netDebt = isNum(m.totalDebt) && isNum(m.cash) ? m.totalDebt - m.cash : null;
  m.ev = isNum(m.marketCap) && isNum(m.netDebt) ? m.marketCap + m.netDebt : pick(c.metricsTTM, 'enterpriseValueTTM');
  m.evEbitda = t.ebitda > 0 ? div(m.ev, t.ebitda) : null;
  m.evSales = div(m.ev, t.revenue);
  m.ps = div(m.marketCap, t.revenue);
  m.pfcf = t.fcf > 0 ? div(m.marketCap, t.fcf) : null;
  m.fcfYield = div(t.fcf, m.marketCap);
  m.equity = pick(lastBS, 'totalStockholdersEquity', 'totalEquity');
  m.pb = m.equity > 0 ? div(m.marketCap, m.equity) : null;
  m.roe = div(t.netIncome, m.equity);
  m.roic = pick(c.metricsTTM, 'returnOnInvestedCapitalTTM', 'roicTTM')
    ?? (isNum(t.operatingIncome) && isNum(m.equity) && isNum(m.totalDebt) && isNum(m.cash) && m.equity + m.totalDebt - m.cash > 0
      ? (t.operatingIncome * 0.79) / (m.equity + m.totalDebt - m.cash) : null);

  // Debt service
  m.debtToEbitda = t.ebitda > 0 ? div(m.totalDebt, t.ebitda) : null;
  m.netDebtToEbitda = t.ebitda > 0 ? div(m.netDebt, t.ebitda) : null;
  m.interestCoverage = t.interestExpense > 0 ? div(t.operatingIncome, t.interestExpense) : null;
  m.fcfToDebt = m.totalDebt > 0 ? div(t.fcf, m.totalDebt) : null;
  m.yearsToRepay = t.fcf > 0 && m.netDebt > 0 ? m.netDebt / t.fcf : (isNum(m.netDebt) && m.netDebt <= 0 ? 0 : null);
  m.currentRatio = div(lastBS.totalCurrentAssets, lastBS.totalCurrentLiabilities);
  m.debtToEquity = m.equity > 0 ? div(m.totalDebt, m.equity) : null;
  m.cashCoversShortTerm = isNum(m.cash) && isNum(m.shortTermDebt) ? m.cash >= m.shortTermDebt : null;
  m.altmanZ = pick(c.scores, 'altmanZScore'); m.piotroski = pick(c.scores, 'piotroskiScore');
  m.debtRating = rateDebt(m);

  // Annual history rows (used everywhere)
  const byYearCash = Object.fromEntries(c.cashA.map((r) => [yearOf(r), r]));
  const byYearBS = Object.fromEntries(c.balanceA.map((r) => [yearOf(r), r]));
  m.history = c.incomeA.map((r) => {
    const y = yearOf(r), cf = byYearCash[y] || {}, bs = byYearBS[y] || {};
    const fcf = pick(cf, 'freeCashFlow');
    return {
      year: y, date: r.date,
      revenue: r.revenue, grossProfit: r.grossProfit, operatingIncome: r.operatingIncome, netIncome: r.netIncome,
      ebitda: r.ebitda, eps: pick(r, 'epsDiluted', 'epsdiluted', 'eps'),
      rnd: r.researchAndDevelopmentExpenses, sga: r.sellingGeneralAndAdministrativeExpenses,
      marketing: r.sellingAndMarketingExpenses, interestExpense: r.interestExpense,
      gross: div(r.grossProfit, r.revenue), operating: div(r.operatingIncome, r.revenue), net: div(r.netIncome, r.revenue),
      ocf: pick(cf, 'operatingCashFlow', 'netCashProvidedByOperatingActivities'), capex: pick(cf, 'capitalExpenditure'), fcf,
      fcfMargin: div(fcf, r.revenue), sbc: pick(cf, 'stockBasedCompensation'),
      buybacks: pick(cf, 'commonStockRepurchased'), dividends: pick(cf, 'commonDividendsPaid', 'netDividendsPaid', 'dividendsPaid'),
      totalDebt: pick(bs, 'totalDebt'), cash: pick(bs, 'cashAndShortTermInvestments', 'cashAndCashEquivalents'),
      marketingPct: div(r.sellingAndMarketingExpenses, r.revenue), sgaPct: div(r.sellingGeneralAndAdministrativeExpenses, r.revenue),
      rndPct: div(r.researchAndDevelopmentExpenses, r.revenue),
      revGrowth: null,
    };
  });
  m.history.forEach((h, i) => { if (i) h.revGrowth = div(h.revenue - m.history[i - 1].revenue, m.history[i - 1].revenue); });
  const H = m.history, n = H.length;
  const histCagr = (k, yrs) => (n > yrs ? cagr(H[n - 1 - yrs][k], H[n - 1][k], yrs) : null);
  m.revCagr3 = histCagr('revenue', 3); m.revCagr5 = histCagr('revenue', 5); m.revCagr10 = histCagr('revenue', 10);
  m.epsCagr5 = histCagr('eps', 5); m.fcfCagr5 = histCagr('fcf', 5);

  // Historical P/E (annual ratios)
  m.peHistory = c.ratiosA.map((r) => ({ year: yearOf(r), pe: pick(r, 'priceToEarningsRatio', 'priceEarningsRatio') })).filter((r) => isNum(r.pe) && r.pe > 0 && r.pe < 400);
  m.pe5yAvg = mean(m.peHistory.slice(-5).map((r) => r.pe));
  m.pe10yAvg = mean(m.peHistory.slice(-10).map((r) => r.pe));

  // Margin durability
  m.durability = {};
  for (const k of ['gross', 'operating', 'net', 'fcfMargin']) {
    const series = H.map((h) => h[k]);
    const last10 = series.slice(-10), last5 = series.slice(-5);
    const sd = stdev(last10), avg = mean(last10), sl = slope(last5);
    m.durability[k] = {
      current: series.at(-1), avg5: mean(last5), avg10: avg, min: Math.min(...last10.filter(isNum)), max: Math.max(...last10.filter(isNum)),
      stdev: sd, trend: sl, years: last10.filter(isNum).length,
      verdict: durabilityVerdict(avg, sd, sl),
    };
  }

  // Segments
  m.segments = analyzeSegments(c.segProduct, m);
  m.geo = analyzeSegments(c.segGeo, m);

  // Earnings track record
  const reported = c.earnings.filter((e) => isNum(pick(e, 'epsActual', 'eps')) && isNum(pick(e, 'epsEstimated')));
  m.beats = reported.filter((e) => pick(e, 'epsActual', 'eps') > e.epsEstimated).length;
  m.reportedCount = reported.length;
  m.nextEarnings = c.earnings.find((e) => e.date >= today && !isNum(pick(e, 'epsActual')))?.date || null;

  // Most recently announced quarter, labelled with the company's own fiscal quarter.
  const done = c.earnings.filter((e) => isNum(pick(e, 'epsActual')) && e.date <= today);
  const lr = done.at(-1);
  if (lr) {
    const q = [...c.incomeQ].filter((r) => r.date <= lr.date).at(-1); // quarter that ended before the report
    const prevYear = q ? c.incomeQ.find((r) => r.period === q.period && String(r.fiscalYear) === String(+q.fiscalYear - 1)) : null;
    const act = pick(lr, 'epsActual'), est = lr.epsEstimated;
    const pending = !!(q && (new Date(lr.date) - new Date(q.date)) / 864e5 > 75);
    // If the newest filed statements are a quarter behind the announcement, the announced quarter is the next one.
    const nextLabel = (r) => { const n = +String(r.period).replace('Q', ''); return n >= 4 ? `Q1 FY${+r.fiscalYear + 1}` : `Q${n + 1} FY${r.fiscalYear}`; };
    m.lastReport = {
      date: lr.date,
      label: !q ? 'Latest quarter' : pending && /^Q\d$/.test(q.period) ? nextLabel(q) : `${q.period} FY${q.fiscalYear}`,
      periodEnd: q?.date || null,
      epsActual: act, epsEstimated: est,
      epsSurprise: isNum(est) && est ? (act - est) / Math.abs(est) : null,
      revActual: lr.revenueActual ?? q?.revenue, revEstimated: lr.revenueEstimated,
      revSurprise: isNum(lr.revenueActual) && lr.revenueEstimated ? lr.revenueActual / lr.revenueEstimated - 1 : null,
      revYoY: q && prevYear && !pending ? div(q.revenue - prevYear.revenue, prevYear.revenue) : null,
      epsYoY: q && prevYear && !pending ? div(pick(q, 'epsDiluted', 'eps') - pick(prevYear, 'epsDiluted', 'eps'), Math.abs(pick(prevYear, 'epsDiluted', 'eps'))) : null,
      grossMargin: q && !pending ? div(q.grossProfit, q.revenue) : null,
      opMargin: q && !pending ? div(q.operatingIncome, q.revenue) : null,
      netMargin: q && !pending ? div(q.netIncome, q.revenue) : null,
      // Statements are filed a few weeks after the press release; flag when the quarter isn't in the data yet.
      statementsPending: pending,
    };
  }

  m.targetPrice = pick(c.priceTarget, 'targetConsensus', 'targetMedian');
  m.upside = m.targetPrice && m.price ? m.targetPrice / m.price - 1 : null;
  return m;
}

function durabilityVerdict(avg, sd, sl) {
  if (!isNum(avg) || !isNum(sd)) return 'Not enough history';
  const rel = Math.abs(avg) > 0.001 ? sd / Math.abs(avg) : 9;
  const trend = !isNum(sl) ? '' : sl > 0.005 ? ', expanding' : sl < -0.005 ? ', contracting' : ', flat';
  if (rel < 0.12) return `Very stable${trend}`;
  if (rel < 0.25) return `Stable${trend}`;
  if (rel < 0.5) return `Somewhat volatile${trend}`;
  return `Volatile${trend}`;
}

function rateDebt(m) {
  if (m.netDebt != null && m.netDebt <= 0) return { grade: 'Strong', note: 'Net cash — more cash than debt.' };
  const lev = m.netDebtToEbitda, cov = m.interestCoverage;
  if (!isNum(lev)) return { grade: 'Unknown', note: 'Not enough data (EBITDA may be negative).' };
  if (lev < 1.5 && (!isNum(cov) || cov > 8)) return { grade: 'Strong', note: `Net debt is ${lev.toFixed(1)}x EBITDA.` };
  if (lev < 3 && (!isNum(cov) || cov > 4)) return { grade: 'Moderate', note: `Net debt is ${lev.toFixed(1)}x EBITDA — manageable.` };
  if (lev < 4.5) return { grade: 'Elevated', note: `Net debt is ${lev.toFixed(1)}x EBITDA — watch refinancing.` };
  return { grade: 'High', note: `Net debt is ${lev.toFixed(1)}x EBITDA — heavy leverage.` };
}

export function analyzeSegments(rows, m) {
  if (!rows.length) return null;
  const latest = rows.at(-1), prev = rows.at(-2), back3 = rows.length > 3 ? rows.at(-4) : null;
  const total = sum(Object.values(latest.data).filter(isNum)) || 0;
  const items = Object.entries(latest.data).filter(([, v]) => isNum(v)).map(([name, v]) => {
    const p = prev?.data?.[name], b = back3?.data?.[name];
    return {
      name, revenue: v, share: total ? v / total : null,
      yoy: isNum(p) && p > 0 ? v / p - 1 : null,
      cagr3: isNum(b) ? cagr(b, v, 3) : null,
      shareChange: prev && isNum(p) ? (total ? v / total : 0) - p / (sum(Object.values(prev.data).filter(isNum)) || 1) : null,
    };
  }).sort((a, b) => b.revenue - a.revenue);
  const growth = (i) => (isNum(i.cagr3) ? i.cagr3 : i.yoy);
  const withG = items.filter((i) => isNum(growth(i)));
  const fastest = [...withG].sort((a, b) => growth(b) - growth(a))[0] || null;
  const shrinking = withG.filter((i) => growth(i) < 0);
  const shrinkShare = sum(shrinking.map((i) => i.share)) || 0;
  return {
    year: latest.year, total, items, fastest, shrinking, shrinkShare,
    biggest: items[0] || null,
    risk: !shrinking.length ? 'No segment is shrinking.'
      : shrinkShare > 0.3 ? `High: shrinking segments are ${(shrinkShare * 100).toFixed(0)}% of revenue.`
      : shrinkShare > 0.1 ? `Moderate: shrinking segments are ${(shrinkShare * 100).toFixed(0)}% of revenue.`
      : `Low: shrinking segments are only ${(shrinkShare * 100).toFixed(0)}% of revenue.`,
    series: rows.map((r) => ({ year: r.year, ...r.data })),
    names: items.map((i) => i.name),
  };
}

// Peer group: lightweight loads, plus peer averages as an industry proxy.
export async function loadPeers(symbols) {
  const out = [];
  // Load in small batches to stay polite with API rate limits.
  const step = isEco() ? 2 : 4;
  for (let i = 0; i < symbols.length; i += step) {
    const batch = await Promise.all(symbols.slice(i, i + step).map((s) => loadCompany(s, { lite: true }).catch(() => null)));
    out.push(...batch.filter(Boolean));
  }
  return out;
}

export function peerRow(c) {
  const m = c.m;
  return {
    symbol: c.symbol, name: m.name, marketCap: m.marketCap, price: m.price,
    covered: c.incomeA.length > 0 || c.incomeQ.length > 0,
    trailingPE: m.trailingPE, forwardPE: m.forwardPE, forwardPE2: m.forwardPE2, peg: m.peg,
    evEbitda: m.evEbitda, ps: m.ps, pfcf: m.pfcf, fcfYield: m.fcfYield,
    gross: m.margins.gross, operating: m.margins.operating, net: m.margins.net, fcfMargin: m.margins.fcf,
    revGrowthNext: m.revGrowthNext, epsGrowthNext: m.epsGrowthNext,
    revenue: m.ttm.revenue, netDebt: m.netDebt, netDebtToEbitda: m.netDebtToEbitda, interestCoverage: m.interestCoverage,
    roic: m.roic, marketingPct: div(m.ttm.marketing, m.ttm.revenue), rndPct: div(m.ttm.rnd, m.ttm.revenue),
  };
}

export const PEER_KEYS = ['trailingPE', 'forwardPE', 'forwardPE2', 'peg', 'evEbitda', 'ps', 'pfcf', 'fcfYield', 'gross', 'operating', 'net', 'fcfMargin', 'revGrowthNext', 'epsGrowthNext', 'netDebtToEbitda', 'interestCoverage', 'roic', 'marketingPct', 'rndPct'];

export function peerAverages(rows) {
  const avg = {}, med = {};
  for (const k of PEER_KEYS) {
    const vals = rows.map((r) => r[k]).filter((v) => isNum(v) && !(k.includes('PE') && v <= 0));
    avg[k] = mean(vals); med[k] = median(vals);
  }
  return { avg, med };
}
