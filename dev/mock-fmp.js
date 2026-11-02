// Dev-only synthetic market data (NOT real numbers) so the UI can be exercised offline.
function rng(seed) { let s = 0; for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const NAMES = { AAPL: 'Apple Inc.', MSFT: 'Microsoft Corporation', GOOGL: 'Alphabet Inc.', NVDA: 'NVIDIA Corporation', AMZN: 'Amazon.com, Inc.', META: 'Meta Platforms', ORCL: 'Oracle', CRM: 'Salesforce', ADBE: 'Adobe', IBM: 'IBM' };
const yr = new Date().getFullYear();
function base(sym) {
  const r = rng(sym);
  return { r, rev0: 20e9 + r() * 200e9, g: 0.04 + r() * 0.18, gm: 0.35 + r() * 0.4, om: 0.12 + r() * 0.25, price: 50 + r() * 400, shares: 1e9 + r() * 14e9 };
}
function income(sym, period, limit) {
  const b = base(sym); const out = [];
  const n = period === 'quarter' ? limit : limit;
  for (let i = n - 1; i >= 0; i--) {
    const y = period === 'quarter' ? yr - Math.floor((i + 1) / 4) : yr - 1 - i;
    const q = period === 'quarter' ? ((3 - (i % 4)) % 4) + 1 : null;
    const t = period === 'quarter' ? (n - i) / 4 : n - i;
    const rev = (b.rev0 * (1 + b.g) ** t) / (period === 'quarter' ? 4 : 1) * (0.95 + b.r() * 0.1);
    const gm = b.gm + (b.r() - 0.5) * 0.03, om = b.om + (b.r() - 0.5) * 0.03;
    const ni = rev * om * 0.8;
    out.push({ date: period === 'quarter' ? `${y}-${String(q * 3).padStart(2, '0')}-28` : `${y}-12-31`, symbol: sym, fiscalYear: String(y), period: q ? `Q${q}` : 'FY',
      revenue: rev, costOfRevenue: rev * (1 - gm), grossProfit: rev * gm, researchAndDevelopmentExpenses: rev * 0.12, sellingAndMarketingExpenses: rev * 0.08,
      generalAndAdministrativeExpenses: rev * 0.04, sellingGeneralAndAdministrativeExpenses: rev * 0.12, operatingIncome: rev * om, interestExpense: rev * 0.006,
      ebitda: rev * (om + 0.05), incomeBeforeTax: ni * 1.2, incomeTaxExpense: ni * 0.2, netIncome: ni, eps: ni / b.shares, epsDiluted: ni / b.shares * 0.99, weightedAverageShsOutDil: b.shares });
  }
  return out.sort((a, c) => c.date.localeCompare(a.date));
}
function balance(sym, period, limit) {
  return income(sym, period, limit).map((r) => ({ date: r.date, fiscalYear: r.fiscalYear, period: r.period, cashAndCashEquivalents: r.revenue * 0.3, cashAndShortTermInvestments: r.revenue * (period === 'quarter' ? 1.6 : 0.4),
    totalDebt: r.revenue * (period === 'quarter' ? 1.2 : 0.3), shortTermDebt: r.revenue * 0.1, longTermDebt: r.revenue * 0.9, capitalLeaseObligations: r.revenue * 0.05, capitalLeaseObligationsCurrent: r.revenue * 0.01,
    netDebt: -r.revenue * 0.1, totalCurrentAssets: r.revenue * 1.5, totalCurrentLiabilities: r.revenue, totalAssets: r.revenue * 4, totalLiabilities: r.revenue * 2.2, totalStockholdersEquity: r.revenue * 1.8, accountPayables: r.revenue * 0.2 }));
}
function cash(sym, period, limit) {
  return income(sym, period, limit).map((r) => ({ date: r.date, fiscalYear: r.fiscalYear, period: r.period, netIncome: r.netIncome, operatingCashFlow: r.netIncome * 1.3, capitalExpenditure: -r.revenue * 0.06,
    freeCashFlow: r.netIncome * 1.3 - r.revenue * 0.06, stockBasedCompensation: r.revenue * 0.03, commonStockRepurchased: -r.netIncome * 0.6, commonDividendsPaid: -r.netIncome * 0.15, depreciationAndAmortization: r.revenue * 0.05 }));
}
export function mockFmp(path, p) {
  const s = (p.symbol || 'AAPL').toUpperCase(); const b = base(s);
  const lim = +p.limit || 10;
  switch (path) {
    case 'profile': return [{ symbol: s, companyName: NAMES[s] || `${s} Corp`, price: b.price, marketCap: b.price * b.shares, sector: 'Technology', industry: 'Software - Infrastructure', exchange: 'NASDAQ', ceo: 'Jane Doe', fullTimeEmployees: '150000', ipoDate: '1990-01-01', description: `${NAMES[s] || s} is a sample company used for offline testing. These numbers are synthetic.`, image: '' }];
    case 'quote': return [{ symbol: s, name: NAMES[s] || s, price: b.price, marketCap: b.price * b.shares, changePercentage: (b.r() - 0.5) * 4 }];
    case 'income-statement': return income(s, p.period, lim);
    case 'balance-sheet-statement': return balance(s, p.period, lim);
    case 'cash-flow-statement': return cash(s, p.period, lim);
    case 'ratios': return income(s, 'annual', lim).map((r) => ({ date: r.date, fiscalYear: r.fiscalYear, priceToEarningsRatio: 18 + b.r() * 20 }));
    case 'ratios-ttm': case 'key-metrics-ttm': return [{ returnOnInvestedCapitalTTM: 0.1 + b.r() * 0.3 }];
    case 'financial-scores': return [{ altmanZScore: 2 + b.r() * 6, piotroskiScore: 5 + Math.floor(b.r() * 4) }];
    case 'analyst-estimates': { const last = income(s, 'annual', 1)[0]; return [0, 1, 2, 3].map((i) => ({ date: `${yr + i}-12-31`, fiscalYear: String(yr + i), revenueAvg: last.revenue * (1 + b.g) ** (i + 1), epsAvg: last.epsDiluted * (1 + b.g + 0.03) ** (i + 1), epsLow: last.epsDiluted * 0.9 * (1 + b.g) ** (i + 1), epsHigh: last.epsDiluted * 1.1 * (1 + b.g + 0.05) ** (i + 1), ebitdaAvg: last.ebitda * (1 + b.g) ** (i + 1), numAnalystsEps: 30 })); }
    case 'stock-peers': return Object.keys(NAMES).filter((x) => x !== s).slice(0, 6).map((x) => ({ symbol: x }));
    case 'revenue-product-segmentation': return [0, 1, 2, 3, 4].map((i) => ({ fiscalYear: yr - 5 + i, date: `${yr - 5 + i}-12-31`, data: { 'Cloud': 30e9 * 1.25 ** i, 'Devices': 50e9 * 0.95 ** i, 'Services': 25e9 * 1.12 ** i, 'Advertising': 15e9 * 1.06 ** i } }));
    case 'revenue-geographic-segmentation': return [0, 1, 2].map((i) => ({ fiscalYear: yr - 3 + i, date: `${yr - 3 + i}-12-31`, data: { 'United States': 60e9 * 1.08 ** i, 'Europe': 30e9 * 1.04 ** i, 'Asia Pacific': 20e9 * 1.1 ** i } }));
    case 'price-target-consensus': return [{ targetConsensus: b.price * 1.12 }];
    case 'grades-consensus': return [{ consensus: 'Buy', strongBuy: 8, buy: 20, hold: 9, sell: 1, strongSell: 0 }];
    case 'earnings': return Array.from({ length: 10 }, (_, i) => { const d = new Date(Date.now() - (i - 1) * 91 * 864e5).toISOString().slice(0, 10); const est = 1 + b.r(); return { date: d, epsEstimated: est, epsActual: i === 0 ? null : est * (0.95 + b.r() * 0.15), revenueEstimated: 20e9, revenueActual: i === 0 ? null : 20.5e9 }; });
    case 'historical-price-eod/light': { const out = []; let px = b.price * 0.6; for (let i = 1300; i >= 0; i--) { px *= 1 + (b.r() - 0.48) * 0.03; out.push({ date: new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), price: px }); } return out.reverse(); }
    case 'earnings-calendar': { const out = []; const syms = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'ORCL', 'CRM', 'ADBE', 'IBM', 'GOOGL', 'XOM', 'JPM', 'PFE', 'KO', 'DIS']; const st = new Date(p.from + 'T12:00:00'); syms.forEach((x, i) => { const d = new Date(st); d.setDate(d.getDate() + (i % 5)); out.push({ symbol: x, date: d.toISOString().slice(0, 10), epsEstimated: 1.2 + i / 10, epsActual: null, revenueEstimated: (30 - i) * 1e9 }); }); out.push({ symbol: 'AAPL', date: new Date().toISOString().slice(0,10), epsEstimated: 1.6, revenueEstimated: 95e9 }); return out; }
    case 'earning-call-transcript-dates': return [{ quarter: 3, fiscalYear: yr, date: `${yr}-10-30` }, { quarter: 2, fiscalYear: yr, date: `${yr}-07-30` }];
    case 'earning-call-transcript': return [{ symbol: s, year: p.year, period: 'Q' + p.quarter, date: `${yr}-10-30`, content: 'Operator: Good afternoon and welcome.\nJane Doe: Thank you. Revenue grew strongly this quarter, led by Cloud. We are raising full-year guidance to $410 billion.\nAnalyst: Can you talk about margins?\nJohn Smith: Gross margin expanded 120 basis points on mix.' }];
    case 'key-executives': return [{ name: 'Jane Doe', title: 'Chief Executive Officer', titleSince: '2015-01-01', yearBorn: 1965, pay: 3e6 }, { name: 'John Smith', title: 'Chief Financial Officer', titleSince: '2020-06-01', yearBorn: 1972, pay: 1.2e6 }];
    case 'governance-executive-compensation': return [{ year: yr - 1, nameAndPosition: 'Jane Doe, CEO', salary: 3e6, stockAward: 40e6, incentivePlanCompensation: 6e6, total: 50e6 }];
    case 'insider-trading/search': return [{ transactionDate: `${yr}-09-12`, reportingName: 'Smith John', typeOfOwner: 'officer: CFO', transactionType: 'S-Sale', securitiesTransacted: 20000, price: b.price }];
    case 'news/stock': case 'news/press-releases': return [{ symbol: s, title: `${NAMES[s] || s} names new Chief Operating Officer`, publishedDate: `${yr}-10-20 09:00:00`, url: 'https://example.com', publisher: 'Sample Wire' }, { symbol: s, title: `${s} launches new product line`, publishedDate: `${yr}-10-18 09:00:00`, url: 'https://example.com', publisher: 'Sample News' }];
    case 'industry-pe-snapshot': return [{ industry: 'Software - Infrastructure', pe: 31.2 }];
    case 'search-symbol': case 'search-name': return Object.entries(NAMES).filter(([k, v]) => (k + v).toLowerCase().includes((p.query || '').toLowerCase())).map(([k, v]) => ({ symbol: k, name: v, exchange: 'NASDAQ' }));
    default: return [];
  }
}
