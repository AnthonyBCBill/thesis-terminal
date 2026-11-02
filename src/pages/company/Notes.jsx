import { useUserData } from '../../lib/userdata.jsx';
import { Card } from '../../components/ui.jsx';

const TEMPLATE = `Thesis:

Why now:

What would make me wrong:

Buy below:          Trim above:

Key metrics to watch next quarter:
`;

export default function Notes({ c }) {
  const { data, setNote, synced } = useUserData();
  const val = data.notes[c.symbol] ?? '';
  return (
    <Card title={`My notes — ${c.symbol}`} sub={synced === 'ok' ? 'Saved to your account (syncs across devices)' : 'Saved on this device'}
      right={!val && <button className="btn sm" onClick={() => setNote(c.symbol, TEMPLATE)}>Use template</button>}>
      <textarea value={val} onChange={(e) => setNote(c.symbol, e.target.value)} placeholder="Write your investment thesis…" style={{ width: '100%', minHeight: 420, lineHeight: 1.6 }} />
    </Card>
  );
}
