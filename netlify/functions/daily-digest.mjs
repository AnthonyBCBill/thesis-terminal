// Runs every weekday at 7:00 AM Eastern (11:00 UTC; 6:00 AM during EDT is
// 10:00 UTC — adjust if you want it exact year-round). Builds the briefing,
// saves it for the dashboard, and sends email / phone push if configured.
import { buildDigest, sendDigest } from '../lib/digest.mjs';

export default async () => {
  const d = await buildDigest();
  const sent = await sendDigest(d);
  console.log('digest built', d.date, d.todayCount, sent);
};

export const config = { schedule: '0 11 * * 1-5' };
