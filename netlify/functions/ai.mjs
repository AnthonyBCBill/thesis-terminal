// Streams a Claude analysis back to the browser as plain text.
// POST /api/ai  { system, prompt, maxTokens }
import { checkAuth, json, env } from '../lib/lib.mjs';

export default async (req) => {
  const denied = checkAuth(req);
  if (denied) return denied;
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const key = env('ANTHROPIC_API_KEY');
  if (!key) return json({ error: 'ANTHROPIC_API_KEY is not set in Netlify' }, 500);

  const { system, prompt, maxTokens = 4000 } = await req.json();
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: env('ANTHROPIC_MODEL') || 'claude-sonnet-5-5',
      max_tokens: maxTokens,
      stream: true,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!upstream.ok) {
    return json({ error: `Anthropic API ${upstream.status}: ${(await upstream.text()).slice(0, 400)}` }, 502);
  }

  // Convert Anthropic's SSE stream into a plain text stream of the answer.
  const reader = upstream.body.getReader();
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let buf = '';
  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) { controller.close(); return; }
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        try {
          const evt = JSON.parse(line.slice(5));
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            controller.enqueue(enc.encode(evt.delta.text));
          } else if (evt.type === 'error') {
            controller.enqueue(enc.encode(`\n\n[AI error: ${evt.error?.message}]`));
          }
        } catch { /* partial line */ }
      }
    },
    cancel() { reader.cancel(); },
  });
  return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache' } });
};

export const config = { path: '/api/ai' };
