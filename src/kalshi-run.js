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
  const title = `${a.kind === 'crypto' ? '₿' : '🏀'} ${a.side} · ${m.title}${a.kind === 'crypto' ? ` · ${m.yesSub}` : ` · ${m.yesSub}`}`.slice(0, 250);
  const closeTs = `<t:${Math.floor(new Date(m.close) / 1000)}:f>`;
  return {
    title, url: `https://kalshi.com/markets/${m.event.split('-')[0].toLowerCase()}`, color: a.edge >= 0.06 ? 0x2ecc71 : 0xf1c40f,
    description: `**Buy ${a.side} at ${cents(a.ask.price)}** (fee ${cents(a.fee)}, all-in ${cents(a.cost)}). Our fair value: **${cents(a.fair)}**. Edge after fees: **${cents(a.edge)} (${Math.round(a.edgePct * 100)}%)**.`,
    fields: [
      { name: '💡 Why the market is wrong', value: a.why.slice(0, 1000) },
      { name: '📐 Where our number comes from', value: a.basis.slice(0, 1000) },
      { name: '💵 Stake (quarter-Kelly on your bankroll)', value: `${money(a.stake)} → ${a.contracts} contracts. Depth at this price: ${Math.round(a.ask.size)} contracts. Closes ${closeTs}.` },
      { name: '🛒 How to place it', value: `Kalshi app → search \`${m.ticker}\` → ${a.side} → limit order at ${cents(a.ask.price)} or better, ${a.contracts} contracts. Don't chase: if the ask moved past ${cents(a.ask.price + 0.01)}, skip.` },
      { name: '⚠️ What breaks it', value: a.risks.slice(0, 3).map(r => `• ${r}`).join('\n') },
    ],
    footer: { text: `${m.ticker} · ${a.kind} · alert, not an order` },
  };
}

export async function kalshiEdge({ post = true } = {}) {
  const bankroll = Number(process.env.KALSHI_BANKROLL || 500);
  await init();
  await sql`create table if not exists kalshi_alerts (id bigserial primary key, ticker text, side text, kind text, fair numeric, price numeric, edge numeric, stake int, at timestamptz default now(), posted boolean default false)`;
  const alerts = [...await scanCrypto({ bankroll }), ...await scanSports({ bankroll })].sort((a, b) => b.edge - a.edge);
  const fresh = [];
  for (const a of alerts) {
    const [seen] = await sql`select 1 from kalshi_alerts where ticker = ${a.market.ticker} and side = ${a.side} and at > now() - interval '6 hours'`;
    if (seen) continue;
    await sql`insert into kalshi_alerts ${sql({ ticker: a.market.ticker, side: a.side, kind: a.kind, fair: a.fair, price: a.ask.price, edge: a.edge, stake: a.stake, posted: post })}`;
    fresh.push(a);
  }
  const chS = process.env.DISCORD_KALSHI_CHANNEL_ID, chC = process.env.DISCORD_CRYPTO_CHANNEL_ID || chS;
  for (const [kind, ch] of [['sports', chS], ['crypto', chC]]) {
    const mine = fresh.filter(a => a.kind === kind);
    if (post && mine.length && ch) await postAsBot(ch, { content: `📊 **${mine.length} ${kind} edge${mine.length > 1 ? 's' : ''}** — our fair value beats the price by 3¢+ after fees. You place the trade; stakes assume a $${bankroll} bankroll.`, embeds: mine.slice(0, 5).map(kalshiCard) });
  }
  try { await upsertLinesBoard(); } catch (e) { console.error('lines board', e.message); }
  console.log(`kalshi: ${alerts.length} edges, ${fresh.length} new`);
  return { alerts, fresh };
}

if (process.argv[1] && /kalshi-run\.js$/.test(process.argv[1])) {
  const { alerts } = await kalshiEdge({ post: !!process.env.POST });
  console.table(alerts.slice(0, 15).map(a => ({ kind: a.kind, ticker: a.market.ticker.slice(0, 30), side: a.side, ask: a.ask.price, fair: Math.round(a.fair * 100) / 100, edge: a.edge, stake: a.stake, depth: Math.round(a.ask.size) })));
  await sql.end();
}
