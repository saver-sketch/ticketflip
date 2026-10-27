// Kalshi edge scan → #kalshi. Runs inside the cron (poll.js) or alone: `node src/kalshi-run.js`.
import { scanCrypto } from './edge/crypto.js';
import { scanSports } from './edge/sports.js';
import { sql, init } from './db.js';
import { postAsBot } from './discord.js';
import { upsertLinesBoard } from './edge/lines.js';

const money = (n) => `$${Math.round(n)}`;
const cents = (p) => `${Math.round(p * 100)}¢`;
export function kalshiCard(a) {
  const m = a.market;
  const what = a.kind === 'crypto' ? `BTC ${a.side === 'YES' ? 'above' : 'below'} $${Math.round(m.strike).toLocaleString()} at ${new Date(m.close).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })}` : m.yesSub;
  const title = `${a.kind === 'crypto' ? '₿' : '🏈'} Buy ${a.side} · ${m.title.replace(/\?$/, '')} · ${what}`.slice(0, 250);
  const lines = [
    `**Do:** buy **${a.side} at ${cents(a.ask.price)} or better**. Limit order, don't chase past ${cents(a.ask.price + 0.01)}.`,
    `**Size:** about ${Math.max(1, Math.round(a.stakePct * 100))}% of whatever you keep on Kalshi. Small on purpose.`,
    `**Where:** Kalshi → search \`${m.ticker}\``,
    `**Why:** fair value ${cents(a.fair)}, you're paying ${cents(a.cost)} all-in → **${cents(a.edge)} edge**. ${a.why.split('. ')[0]}.`,
    `**Out:** settles <t:${Math.floor(new Date(m.close) / 1000)}:R>. No exit needed.`,
    `_More? Ask @Ticketflip in #chat._`,
  ];
  return { title, url: `https://kalshi.com/markets/${m.event.split('-')[0].toLowerCase()}`, color: a.edge >= 0.06 ? 0x2ecc71 : 0xf1c40f, description: lines.join('\n').slice(0, 1500), footer: { text: `${m.ticker} · alert, not an order` } };
}

export async function kalshiEdge({ post = true } = {}) {
  await init();
  await sql`create table if not exists kalshi_alerts (id bigserial primary key, ticker text, side text, kind text, fair numeric, price numeric, edge numeric, stake int, at timestamptz default now(), posted boolean default false)`;
  const alerts = [...await scanCrypto(), ...await scanSports()].sort((a, b) => b.edge - a.edge);
  const fresh = [];
  for (const a of alerts) {
    const [seen] = await sql`select 1 from kalshi_alerts where ticker = ${a.market.ticker} and side = ${a.side} and at > now() - interval '6 hours'`;
    if (seen) continue;
    await sql`insert into kalshi_alerts ${sql({ ticker: a.market.ticker, side: a.side, kind: a.kind, fair: a.fair, price: a.ask.price, edge: a.edge, stake: Math.round(a.stakePct * 100), posted: post })}`;
    fresh.push(a);
  }
  const chS = process.env.DISCORD_KALSHI_CHANNEL_ID, chC = process.env.DISCORD_CRYPTO_CHANNEL_ID || chS;
  for (const [kind, ch] of [['sports', chS], ['crypto', chC]]) {
    const mine = fresh.filter(a => a.kind === kind);
    if (post && mine.length && ch) await postAsBot(ch, { content: `📊 **${mine.length} ${kind} play${mine.length > 1 ? 's' : ''}** right now:`, embeds: mine.slice(0, 5).map(kalshiCard) });
  }
  try { await upsertLinesBoard(); } catch (e) { console.error('lines board', e.message); }
  console.log(`kalshi: ${alerts.length} edges, ${fresh.length} new`);
  return { alerts, fresh };
}

if (process.argv[1] && /kalshi-run\.js$/.test(process.argv[1])) {
  const { alerts } = await kalshiEdge({ post: !!process.env.POST });
  console.table(alerts.slice(0, 15).map(a => ({ kind: a.kind, ticker: a.market.ticker.slice(0, 30), side: a.side, ask: a.ask.price, fair: Math.round(a.fair * 100) / 100, edge: a.edge, sizePct: a.stakePct, depth: Math.round(a.ask.size) })));
  await sql.end();
}
