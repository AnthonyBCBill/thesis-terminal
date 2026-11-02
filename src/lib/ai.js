// Claude-powered qualitative research. Every prompt is grounded in the numbers we pulled.
import { getAppKey } from './api.js';
import { money, pct, mult, num } from './format.js';

export async function streamAI({ system, prompt, maxTokens = 4000 }, onText) {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-app-key': getAppKey() },
    body: JSON.stringify({ system, prompt, maxTokens }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `AI request failed (${res.status})`);
  }
  // The server relays Anthropic's event stream; pull the text out of it here.
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = '', buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      let evt; try { evt = JSON.parse(line.slice(5)); } catch { continue; }
      if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') full += evt.delta.text;
      else if (evt.type === 'error') throw new Error(`AI error: ${evt.error?.message || 'unknown'}`);
    }
    onText(full);
  }
  return full;
}

const AIKEY = (sym, kind) => `thesis:ai:${sym}:${kind}`;
export const loadAI = (sym, kind) => { try { return JSON.parse(localStorage.getItem(AIKEY(sym, kind))); } catch { return null; } };
export const saveAI = (sym, kind, text, meta = {}) => {
  try { localStorage.setItem(AIKEY(sym, kind), JSON.stringify({ text, at: new Date().toISOString(), ...meta })); } catch { /* full */ }
};

const SYSTEM = `You are a senior buy-side equity analyst writing for a private investor who makes his own decisions.
Be specific, quantitative and candid. Use the data pack provided as ground truth for numbers; when you rely on your own
background knowledge (industry structure, products, competitors, management history), say so and note it may be out of date.
Never invent figures. If something is unknown, say "Unknown from available data". Use Markdown headings (##), short
paragraphs, bullet lists and tables where useful. No investment advice disclaimers beyond one line at the end.`;

export function dataPack(c, peers = [], avgs = null) {
  const m = c.m, t = m.ttm;
  const L = [];
  L.push(`Company: ${m.name} (${c.symbol}) — Sector: ${m.sector || '?'} / Industry: ${m.industry || '?'}`);
  L.push(`Description: ${(c.profile.description || '').slice(0, 1200)}`);
  L.push(`CEO: ${c.profile.ceo || '?'} | Employees: ${c.profile.fullTimeEmployees || '?'} | IPO: ${c.profile.ipoDate || '?'}`);
  L.push(`Price ${num(m.price)} | Market cap ${money(m.marketCap)} | EV ${money(m.ev)}`);
  L.push(`Valuation: trailing P/E ${mult(m.trailingPE)}, forward P/E (FY${m.estNext?.year || '?'}) ${mult(m.forwardPE)}, FY+2 P/E ${mult(m.forwardPE2)}, PEG ${num(m.peg)}, EV/EBITDA ${mult(m.evEbitda)}, P/S ${mult(m.ps)}, P/FCF ${mult(m.pfcf)}, FCF yield ${pct(m.fcfYield)}; 5y avg P/E ${mult(m.pe5yAvg)}`);
  L.push(`Consensus: next FY revenue growth ${pct(m.revGrowthNext)}, EPS growth ${pct(m.epsGrowthNext)}; FY+2 revenue growth ${pct(m.revGrowthNext2)}, EPS growth ${pct(m.epsGrowthNext2)}; price target ${num(m.targetPrice)} (${pct(m.upside)} upside)`);
  L.push(`TTM: revenue ${money(t.revenue)}, gross margin ${pct(m.margins.gross)}, operating margin ${pct(m.margins.operating)}, net margin ${pct(m.margins.net)}, FCF ${money(t.fcf)} (FCF margin ${pct(m.margins.fcf)}), SBC ${money(t.sbc)}`);
  L.push(`Spend: R&D ${money(t.rnd)}, SG&A ${money(t.sga)}, Sales & marketing ${money(t.marketing)} (${pct(t.marketing && t.revenue ? t.marketing / t.revenue : null)} of revenue)`);
  L.push(`Balance sheet: cash & ST investments ${money(m.cash)}, total debt ${money(m.totalDebt)} (short-term ${money(m.shortTermDebt)}, long-term ${money(m.longTermDebt)}), lease obligations ${money(m.leases)}, net debt ${money(m.netDebt)}`);
  L.push(`Debt service: net debt/EBITDA ${mult(m.netDebtToEbitda)}, interest coverage ${mult(m.interestCoverage)}, FCF/debt ${pct(m.fcfToDebt)}, current ratio ${num(m.currentRatio)}, Altman Z ${num(m.altmanZ)}, Piotroski ${m.piotroski ?? '?'}`);
  L.push(`Growth history: revenue CAGR 3y ${pct(m.revCagr3)}, 5y ${pct(m.revCagr5)}, 10y ${pct(m.revCagr10)}; EPS CAGR 5y ${pct(m.epsCagr5)}`);
  L.push('Annual history (year: revenue | gross | operating | net | FCF margin | S&M % rev):');
  for (const h of m.history.slice(-10)) L.push(`  ${h.year}: ${money(h.revenue)} | ${pct(h.gross)} | ${pct(h.operating)} | ${pct(h.net)} | ${pct(h.fcfMargin)} | ${pct(h.marketingPct)}`);
  for (const [k, d] of Object.entries(m.durability)) L.push(`Margin durability ${k}: 10y avg ${pct(d.avg10)}, range ${pct(d.min)}–${pct(d.max)}, verdict: ${d.verdict}`);
  if (m.segments) {
    L.push(`Product/service segments FY${m.segments.year}:`);
    for (const s of m.segments.items) L.push(`  ${s.name}: ${money(s.revenue)} (${pct(s.share)} of revenue), YoY ${pct(s.yoy)}, 3y CAGR ${pct(s.cagr3)}`);
  }
  if (m.geo) L.push(`Geography FY${m.geo.year}: ` + m.geo.items.map((s) => `${s.name} ${pct(s.share)}`).join(', '));
  if (peers.length) {
    L.push('Peers (trailing P/E | forward P/E | gross | operating | net margin | next-FY rev growth | mkt cap):');
    for (const p of peers) L.push(`  ${p.symbol} ${p.name}: ${mult(p.trailingPE)} | ${mult(p.forwardPE)} | ${pct(p.gross)} | ${pct(p.operating)} | ${pct(p.net)} | ${pct(p.revGrowthNext)} | ${money(p.marketCap)}`);
  }
  if (avgs) L.push(`Peer-group averages: trailing P/E ${mult(avgs.avg.trailingPE)}, forward P/E ${mult(avgs.avg.forwardPE)}, gross ${pct(avgs.avg.gross)}, operating ${pct(avgs.avg.operating)}, net ${pct(avgs.avg.net)}`);
  L.push(`Earnings track record: beat EPS estimates ${m.beats}/${m.reportedCount} reported quarters.`);
  return L.join('\n');
}

export function memoPrompt(c, peers, avgs, transcript) {
  return `Write a full investment research memo on ${c.symbol}. Answer EVERY question below under its own heading, in this order.

## 1. Valuation — is it cheap or expensive vs its history, peers and growth?
## 2. Industry — structure, size, growth rate, cyclicality, key trends
## 3. Competition — who they compete with, market share, how competitors' margins compare and the peer/industry average margins
## 4. Products & services — best sellers, why they are better than alternatives, % of revenue from each
## 5. Growth — where most product/service growth is, WHY that category is growing, which segment is most likely to grow and which to shrink
## 6. Shrinking segment risk — is the shrinking segment a danger? Are margins higher on the growing or shrinking segment?
## 7. Moat — does it have one, what type (network effects, switching costs, scale, intangibles, cost advantage), and evidence
## 8. Margin durability — how long margins have held where they are and whether they can be sustained
## 9. Debt profile — total debt, total cash, financing/lease obligations, maturities, ability to service the debt
## 10. Cash flow — quality of earnings, FCF conversion, capital allocation (buybacks, dividends, M&A)
## 11. Market fit — product-market fit evidence (growth, retention, pricing power)
## 12. Management — talent and experience of the team, track record, incentives
## 13. Marketing — marketing budget (S&M as % of revenue and trend) and go-to-market strategy
## 14. Guidance & outlook — latest guidance and what consensus expects
## 15. Bull case / Bear case / Key things to monitor
## 16. Scorecard — a table scoring 1–10: Valuation, Growth, Profitability, Margin durability, Balance sheet, Moat, Management, with one-line rationale each

DATA PACK:
${dataPack(c, peers, avgs)}
${transcript ? `\nMOST RECENT EARNINGS CALL TRANSCRIPT (excerpt):\n${transcript.slice(0, 60000)}` : ''}`;
}

export function transcriptPrompt(c, t) {
  return `Analyze this ${c.symbol} earnings call (${t.label}). Structure:
## Headline (3 bullets)
## Guidance — exact numbers given for next quarter / full year, raised/lowered/maintained vs prior, and how it compares with consensus in the data pack
## Growth drivers — which products/segments are growing and why, per management
## Margins & costs — commentary on gross/operating margin, pricing, cost pressure
## Capital allocation & balance sheet — buybacks, dividends, debt, capex
## Products & competition — new launches, competitive position, moat commentary
## Marketing & go-to-market
## Management — tone (confident / cautious / defensive), any leadership changes, notable quotes (short)
## Analyst Q&A — the toughest questions and how well they were answered
## Red flags & things to watch next quarter

DATA PACK:
${dataPack(c)}

TRANSCRIPT:
${t.content.slice(0, 120000)}`;
}

export function managementPrompt(c, execs, comp, insider, news) {
  return `Assess the management team of ${c.symbol}: talent, experience, track record, tenure, incentives/pay alignment, insider buying/selling,
recent leadership changes and anything notable in the news. End with a table: Executive | Role | Since | Background (from your knowledge) | Assessment.
Flag any departures or new hires as "MANAGEMENT UPDATE".

Key executives: ${JSON.stringify(execs.slice(0, 15))}
Executive compensation (recent): ${JSON.stringify(comp.slice(0, 12))}
Insider transactions (recent): ${JSON.stringify(insider.slice(0, 30).map((i) => ({ d: i.transactionDate, who: i.reportingName, role: i.typeOfOwner, type: i.transactionType, sh: i.securitiesTransacted, px: i.price })))}
Recent headlines: ${news.slice(0, 25).map((n) => `${String(n.publishedDate).slice(0, 10)} ${n.title}`).join(' | ')}

DATA PACK:
${dataPack(c)}`;
}

export function comparePrompt(rows) {
  return `Compare these companies head-to-head for a long-term investor: valuation (trailing & forward P/E vs growth), margins, balance sheet,
growth outlook, moat, and risks. Finish with a ranked table (best to worst risk/reward) and one sentence per company on why.
${rows.map((r) => `${r.symbol} ${r.name}: price ${num(r.price)}, mkt cap ${money(r.marketCap)}, trailing P/E ${mult(r.trailingPE)}, fwd P/E ${mult(r.forwardPE)}, PEG ${num(r.peg)}, EV/EBITDA ${mult(r.evEbitda)}, gross ${pct(r.gross)}, op ${pct(r.operating)}, net ${pct(r.net)}, FCF margin ${pct(r.fcfMargin)}, next-FY rev growth ${pct(r.revGrowthNext)}, EPS growth ${pct(r.epsGrowthNext)}, net debt/EBITDA ${mult(r.netDebtToEbitda)}, ROIC ${pct(r.roic)}`).join('\n')}`;
}

export { SYSTEM };

// ---------------- AI Grade ----------------
export const GRADE_SCALE = ['S', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];

export const CRITERIA = [
  ['Valuation', ['Understand the valuation', 'Trailing P/E of the company', 'Forward P/E of the company', 'Trailing and forward P/E of all their peers']],
  ['Industry & competition', ['Understand the industry', 'Understand the competition', "What are the competitors' margins", 'Industry average margins', 'Do they have a moat and what is the moat', 'How long margins have held and whether they can be sustained']],
  ['Products & segments', ["What products they have and why they're better", 'Best selling products/services', 'Where is most of the product/service growth', 'Why is that category growing', '% of revenue from each product or service', 'Which segment is most likely to grow and shrink', 'Is the shrinking segment a danger to the business', 'Are margins higher on the growing or shrinking segment']],
  ['Balance sheet & cash flow', ['Debt profile', 'Ability to service the debt', 'Cash flow', 'Total debt', 'Total cash', 'Financing obligations', 'Net, gross and operating margins']],
  ['Management & go-to-market', ['Market fit', 'Talent on the management team', 'Experience of the management team', 'Marketing budget and strategy']],
];

function quartersTable(c) {
  return c.incomeQ.slice(-8).map((q) => `  ${q.period} FY${q.fiscalYear} (ended ${q.date}): revenue ${money(q.revenue)}, gross ${pct(q.revenue ? q.grossProfit / q.revenue : null)}, operating ${pct(q.revenue ? q.operatingIncome / q.revenue : null)}, net ${pct(q.revenue ? q.netIncome / q.revenue : null)}, EPS ${num(q.epsDiluted ?? q.eps)}`).join('\n');
}

export function gradePrompt(c, peers, avgs, transcript) {
  const m = c.m, r = m.lastReport;
  const latest = r
    ? `MOST RECENT EARNINGS (the primary input for this grade): ${r.label}, announced ${r.date}. EPS ${num(r.epsActual)} vs estimate ${num(r.epsEstimated)} (surprise ${pct(r.epsSurprise)}); revenue ${money(r.revActual)} vs estimate ${money(r.revEstimated)} (surprise ${pct(r.revSurprise)}); revenue YoY ${pct(r.revYoY)}, EPS YoY ${pct(r.epsYoY)}; quarter margins gross ${pct(r.grossMargin)} / operating ${pct(r.opMargin)} / net ${pct(r.netMargin)}.${r.statementsPending ? ' Full statements for this quarter are not yet in the data; use the reported EPS/revenue and your knowledge of the release.' : ''}`
    : 'MOST RECENT EARNINGS: not available in the data — use the latest quarter in the table and your own knowledge of the latest report, and say so.';
  const recentEarnings = c.earnings.filter((e) => e.epsActual != null).slice(-6).map((e) => `  ${e.date}: EPS ${num(e.epsActual)} vs est ${num(e.epsEstimated)}; revenue ${money(e.revenueActual)} vs est ${money(e.revenueEstimated)}`).join('\n');
  const items = CRITERIA.flatMap(([, list]) => list);
  return `Grade ${c.symbol} for a long-term investor. Base the grade primarily on the MOST RECENT EARNINGS and the trend in the latest quarters, together with the full data pack.

OVERALL GRADE SCALE (growth-adjusted valuation):
S  = extremely undervalued
A+ / A / A- = very undervalued
B+ / B / B- = somewhat undervalued
C+ / C / C- = properly valued (C+ leans cheap, C- leans expensive)
D+ / D / D- = overvalued (D- = badly overvalued)
F  = nearing bankruptcy / serious financial distress (use ONLY for solvency risk: can't service debt, burning cash with little runway, Altman Z deep in distress zone). Distress overrides price.

GROWTH ADJUSTMENT — this is essential: do NOT grade on headline P/E alone. A company like Tesla or Palantir can look expensive on trailing P/E yet justify it through revenue/EPS growth, margin expansion, a large addressable market, optionality and moat. Credit growth explicitly: compare forward P/E with EPS growth (PEG), growth durability, reinvestment runway, and margin trajectory. Conversely, a low P/E on a shrinking business is not automatically cheap. State the growth-adjusted reasoning in "growthAdjustment".

ALSO grade each of the investor's checklist items. For each item give a letter from the same +/- scale but meaning QUALITY / attractiveness for an investor (S exceptional ... C average ... F very poor), and a one-to-two sentence, specific, number-backed finding. Where data is missing, use your own knowledge and say "(from general knowledge)". The items, in this exact order:
${items.map((x, i) => `${i + 1}. ${x}`).join('\n')}

Respond with ONLY a JSON object, no markdown fences, exactly in this shape:
{
  "overall": "B+",
  "label": "Somewhat undervalued",
  "score": 72,
  "oneLiner": "one sentence verdict",
  "summary": "3-5 sentence explanation",
  "growthAdjustment": "2-4 sentences on how growth changes the valuation call",
  "latestEarnings": { "quarter": "${r ? r.label : ''}", "date": "${r ? r.date : ''}", "verdict": "beat/miss/in-line and what it means", "highlights": ["...", "..."] },
  "fairValue": { "low": 0, "mid": 0, "high": 0, "method": "how you estimated it" },
  "criteria": [ { "item": "Understand the valuation", "grade": "B", "finding": "..." } ],
  "bull": ["...", "..."],
  "bear": ["...", "..."],
  "whatWouldChangeTheGrade": ["...", "..."]
}
"score" is 0-100 where 100 = S and 0 = F. fairValue numbers are per-share prices (current price ${num(m.price)}).

${latest}

RECENT QUARTERS:
${quartersTable(c)}

EARNINGS HISTORY (actual vs estimate):
${recentEarnings}

DATA PACK:
${dataPack(c, peers, avgs)}
${transcript ? `\nLATEST EARNINGS CALL TRANSCRIPT (excerpt):\n${transcript.slice(0, 50000)}` : ''}`;
}

export function parseGrade(text) {
  if (!text) return null;
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(text.slice(a, b + 1)); } catch { return null; }
}
