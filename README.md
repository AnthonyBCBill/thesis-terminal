# Thesis — personal equity research terminal

A private stock research app built around one investor's decision checklist, styled after fiscal.ai, with Excel export.

## What it does

- **Daily briefing**: shows who reports earnings today (largest first), your watchlist's upcoming earnings and latest beats/misses, price moves and news. It is pushed to your phone (ntfy) and/or email (Resend) every weekday morning.
- **Earnings calendar**: a week view with size filters and a watchlist-only mode. Exports to Excel.
- **Company research**, with 12 tabs:
  - **Overview & Checklist**: every question in the framework, answered from data, with green/yellow/red flags
  - **Valuation & Growth**: trailing and forward P/E, FY+2 P/E, PEG, EV/EBITDA, P/E history, industry P/E, consensus estimates by year, implied value, a return calculator
  - **Financials**: 10–15 years of income statement, balance sheet and cash flow, annual or quarterly
  - **Margins**: gross, operating, net and FCF margin history; margins vs the peer/industry average; a margin durability verdict
  - **Products & Segments**: % of revenue by product and by geography, growth, fastest-growing and shrinking segments, shrinking-segment risk
  - **Debt & Cash**: total debt, total cash, lease/financing obligations, coverage, leverage, Altman Z, Piotroski
  - **Cash Flow**: operating cash flow, capex, FCF, FCF conversion, stock-based comp, buybacks, dividends
  - **Competition**: an editable peer group with trailing and forward P/E, margins and growth for every peer, plus peer average and median
  - **Management**: executives, tenure, pay, insider trades, leadership-change headlines, AI assessment
  - **Earnings & Transcripts**: beat/miss history, full call transcripts with search, AI analysis of guidance and management tone
  - **AI Research Memo**: a Claude-written memo covering industry, competition, products, moat, segment margins, market fit, management and marketing
  - **My Notes**: your thesis, synced across devices
- **Compare**: up to 8 companies in Excel-style columns, with charts and an AI head-to-head.
- **Excel**: a one-click workbook per company with statements, margins, segments, estimates and peers.

## Deploy (Netlify)

1. In Netlify, choose **Add new site → Import an existing project → GitHub** and select this repo. The build settings come from `netlify.toml`.
2. Under **Site configuration → Environment variables**, add:

| Variable | Required | Notes |
|---|---|---|
| `FMP_API_KEY` | yes | https://site.financialmodelingprep.com — transcripts need Starter or higher |
| `ANTHROPIC_API_KEY` | yes | https://console.anthropic.com |
| `APP_PASSWORD` | recommended | Locks the app to you. Enter the same value in the app's Settings page. |
| `NTFY_TOPIC` | optional | Daily phone push — subscribe to the same topic in the ntfy app |
| `RESEND_API_KEY` + `ALERT_EMAIL` | optional | Daily email |
| `ANTHROPIC_MODEL` | optional | Defaults to `claude-sonnet-5-5` |

3. Redeploy, open the site, go to **Settings** and click **Run check**.

## Local development

```bash
npm install
MOCK=1 ANTHROPIC_API_KEY=mock npm run dev   # offline, synthetic data (not real numbers)
FMP_API_KEY=... ANTHROPIC_API_KEY=... npm run dev   # real data
```

## Structure

- `netlify/functions/`: `fmp` (data proxy; the key never reaches the browser), `ai` (streams Claude responses), `userdata` (watchlist and notes stored in Netlify Blobs), `briefing`, and `daily-digest` (scheduled 11:00 UTC on weekdays)
- `src/lib/company.js`: loads all the data and computes every metric
- `src/lib/ai.js`: the prompts, grounded in a "data pack" of computed numbers
- `src/pages/`: the screens
