// Dev-only: runs the Netlify functions inside Vite. MOCK=1 serves synthetic data.
import { mockFmp } from './mock-fmp.js';

export function devApi() {
  return {
    name: 'thesis-dev-api',
    configureServer(server) {
      if (process.env.MOCK) {
        process.env.FMP_API_KEY = process.env.FMP_API_KEY || 'mock';
        const real = globalThis.fetch;
        globalThis.fetch = async (url, opts) => {
          const u = new URL(String(url));
          if (u.hostname === 'financialmodelingprep.com') {
            const path = u.pathname.replace('/stable/', '');
            return new Response(JSON.stringify(mockFmp(path, Object.fromEntries(u.searchParams))), { status: 200 });
          }
          if (u.hostname === 'api.anthropic.com' && String(opts?.body || '').includes('GROWTH ADJUSTMENT')) {
            const g = { overall: 'B+', label: 'Somewhat undervalued', score: 71, oneLiner: 'Sample: quality compounder trading slightly below growth-adjusted value.', summary: 'Sample summary (dev mock).', growthAdjustment: 'Sample growth adjustment.', latestEarnings: { quarter: 'Q3 FY2026', date: '2026-10-30', verdict: 'Beat on EPS and revenue', highlights: ['Cloud +25%', 'Margins up 120bp'] }, fairValue: { low: 380, mid: 470, high: 560, method: 'Forward P/E band x FY+1 EPS' }, criteria: [{ item: 'Understand the valuation', grade: 'B', finding: 'Forward P/E 19x vs peers 24x.' }, { item: 'Debt profile', grade: 'A', finding: 'Net cash.' }, { item: 'Do they have a moat and what is the moat', grade: 'A-', finding: 'Switching costs.' }], bull: ['a', 'b'], bear: ['c'], whatWouldChangeTheGrade: ['d'] };
            const sse = `data: {"type":"content_block_delta","delta":{"type":"text_delta","text":${JSON.stringify(JSON.stringify(g))}}}\n\n`;
            return new Response(sse, { status: 200 });
          }
          if (u.hostname === 'api.anthropic.com') {
            const md = '## 1. Valuation\\nSample AI output (dev mock).\\n\\n| Factor | Score |\\n|---|---|\\n| Moat | 8 |\\n\\n- **Bull:** strong cloud growth\\n- **Bear:** device decline';
            const sse = `data: {"type":"content_block_delta","delta":{"type":"text_delta","text":${JSON.stringify(md.replace(/\\n/g, '\n'))}}}\n\n`;
            return new Response(sse, { status: 200 });
          }
          return real(url, opts);
        };
      }
      const routes = [
        [/^\/api\/fmp\//, '/netlify/functions/fmp.mjs'],
        [/^\/api\/ai$/, '/netlify/edge-functions/ai.js'],
        [/^\/api\/userdata$/, '/netlify/functions/userdata.mjs'],
        [/^\/api\/briefing$/, '/netlify/functions/briefing.mjs'],
      ];
      server.middlewares.use(async (req, res, next) => {
        const path = req.url.split('?')[0];
        const hit = routes.find(([re]) => re.test(path));
        if (!hit) return next();
        try {
          const mod = await server.ssrLoadModule(hit[1]);
          const chunks = []; for await (const c of req) chunks.push(c);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;
          const request = new Request('http://localhost' + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
          const r = await mod.default(request, {});
          res.statusCode = r.status;
          r.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await r.arrayBuffer()));
        } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e.stack || e) })); }
      });
    },
  };
}
