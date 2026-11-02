// Streams Claude's answer straight through to the browser.
// Runs as an Edge Function so long analyses (AI Grade, memos) aren't cut off by
// the regular function time limit — it just pipes bytes, using almost no CPU.
const env = (k) => globalThis.Netlify?.env?.get(k) ?? globalThis.process?.env?.[k] ?? '';
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });

export default async (req) => {
  const pw = env('APP_PASSWORD');
  if (pw && req.headers.get('x-app-key') !== pw) return json({ error: 'unauthorized' }, 401);
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const key = env('ANTHROPIC_API_KEY');
  if (!key) return json({ error: 'ANTHROPIC_API_KEY is not set in Netlify' }, 500);
  const { system, prompt, maxTokens = 4000 } = await req.json();
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: env('ANTHROPIC_MODEL') || 'claude-sonnet-5-5',
      max_tokens: maxTokens, stream: true, system,
      // Keep the whole token budget for the written answer (no hidden reasoning blocks).
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!upstream.ok) return json({ error: `Anthropic API ${upstream.status}: ${(await upstream.text()).slice(0, 400)}` }, 502);
  return new Response(upstream.body, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } });
};

export const config = { path: '/api/ai' };
