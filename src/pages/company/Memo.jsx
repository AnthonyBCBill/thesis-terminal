import { useState } from 'react';
import { Card, Markdown, Spinner, Err } from '../../components/ui.jsx';
import { streamAI, loadAI, saveAI, memoPrompt, SYSTEM } from '../../lib/ai.js';
import { getLatestTranscript } from './Earnings.jsx';
import { shortDate } from '../../lib/format.js';

export default function Memo({ c, peerRows, avgs, peerLoading }) {
  const [memo, setMemo] = useState(() => loadAI(c.symbol, 'memo'));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const [useTr, setUseTr] = useState(true);

  const run = async () => {
    setBusy(true); setErr('');
    let transcript = null;
    if (useTr) {
      setStatus('Pulling latest earnings call transcript…');
      try { transcript = await getLatestTranscript(c.symbol); } catch { /* plan may not include transcripts */ }
    }
    setStatus(transcript ? `Writing memo using ${transcript.label} call…` : 'Writing memo…');
    try {
      const text = await streamAI({ system: SYSTEM, prompt: memoPrompt(c, peerRows, avgs, transcript?.content), maxTokens: 12000 },
        (t) => setMemo({ text: t, at: new Date().toISOString(), transcript: transcript?.label }));
      saveAI(c.symbol, 'memo', text, { transcript: transcript?.label });
    } catch (e) { setErr(e.message); }
    setBusy(false); setStatus('');
  };

  const print = () => {
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>${c.symbol} memo</title><style>body{font:14px/1.6 Inter,Arial;max-width:820px;margin:30px auto;padding:0 20px}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:5px 8px}h2{border-bottom:1px solid #eee;padding-bottom:4px}</style></head><body>${document.querySelector('.memo-body')?.innerHTML || ''}</body></html>`);
    w.document.close(); w.print();
  };

  return (
    <Card title="AI Research Memo" sub="Answers every item on your checklist — industry, competition, products, moat, growth, segment risk, debt, cash flow, market fit, management, marketing — grounded in the numbers on every tab, the peer group and the latest earnings call."
      right={<div className="row">
        <label className="sub row" style={{ gap: 4 }}><input type="checkbox" checked={useTr} onChange={(e) => setUseTr(e.target.checked)} /> include latest transcript</label>
        {memo && <button className="btn" onClick={print}>Print / PDF</button>}
        <button className="btn primary" onClick={run} disabled={busy || peerLoading}>{busy ? <><Spinner /> Working…</> : peerLoading ? 'Loading peers…' : memo ? 'Regenerate' : 'Generate memo'}</button>
      </div>}>
      <Err>{err}</Err>
      {status && <div className="info-box" style={{ marginBottom: 10 }}><Spinner /> {status}</div>}
      {memo ? (
        <>
          <div className="sub">Generated {shortDate(memo.at)}{memo.transcript ? ` · used ${memo.transcript} earnings call` : ''}</div>
          <div className="memo-body"><Markdown text={memo.text} /></div>
        </>
      ) : <div className="empty">No memo yet for {c.symbol}. Generating takes about a minute.</div>}
    </Card>
  );
}
