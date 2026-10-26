// #buys / #sold ledger: reads member posts, records them, keeps the pinned Positions + Scoreboard boards.
// Reads need a token (bot or user). Boards and confirmations go out through the channel webhooks (no token).
import Anthropic from '@anthropic-ai/sdk';
import { cfg } from './config.js';
import { sql } from './db.js';

const H = () => ({ authorization: process.env.DISCORD_BOT_TOKEN ? `Bot ${process.env.DISCORD_BOT_TOKEN}` : process.env.DISCORD_USER_TOKEN, 'content-type': 'application/json' });
const canRead = () => !!(process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_USER_TOKEN);
const hookParts = (url) => { const [id, token] = (url || '').split('/webhooks/')[1]?.split('/') || []; return { id, token }; };
const money = (n) => `$${Math.round(Number(n))}`;

export async function initLedger() {
  await sql`alter table picks add column if not exists who text`;
  await sql`alter table picks add column if not exists msg_id text unique`;
  await sql`alter table picks add column if not exists channel text`;
  await sql`create table if not exists kv (k text primary key, v text)`;
}
const kvGet = async (k) => (await sql`select v from kv where k = ${k}`)[0]?.v || null;
const kvSet = async (k, v) => sql`insert into kv (k, v) values (${k}, ${v}) on conflict (k) do update set v = excluded.v`;

// "bought 4 Interpol Philly 2/3 @ $62" | "sold 2 Interpol Philly @ $140 StubHub"
function parseQuick(text) {
  const m = text.match(/^\s*(bought|buy|sold|sell)\s+(\d{1,2})\s*(?:x\s*)?(.+?)\s*(?:@|at|for)\s*\$?\s*(\d+(?:\.\d+)?)\s*(?:each|ea|per)?\s*(?:on\s+)?([A-Za-z]+)?/i);
  if (!m) return null;
  return { action: /^(bought|buy)/i.test(m[1]) ? 'bought' : 'sold', qty: Number(m[2]), what: m[3].trim(), price: Number(m[4]), marketplace: m[5] && !/each|ea|per|tickets?|tix/i.test(m[5]) ? m[5] : null };
}
async function parseSlow(text, channel) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();
    const r = await client.messages.create({ model: 'claude-opus-5-5', max_tokens: 200, output_config: { effort: 'low' }, messages: [{ role: 'user', content: `A member of a ticket-flipping Discord posted this in #${channel}: "${text}"\nIf it reports buying or selling tickets, reply with ONLY JSON {"action":"bought"|"sold","qty":<int>,"what":"<act + city/date as written>","price":<number per ticket>,"marketplace":"<StubHub|TickPick|Ticketmaster|Gametime|Vivid|null>"}. If it is not a buy/sell report, reply null.` }] });
    const t = r.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const j = JSON.parse(t.match(/\{[\s\S]*\}/)?.[0] || 'null');
    return j && j.qty && j.price ? j : null;
  } catch { return null; }
}

async function readNew(channelId, key) {
  const after = await kvGet(key);
  const u = new URL(`https://discord.com/api/v9/channels/${channelId}/messages`); u.searchParams.set('limit', '50'); if (after) u.searchParams.set('after', after);
  const r = await fetch(u, { headers: H() });
  if (!r.ok) { console.log('ledger read', channelId, r.status); return []; }
  const msgs = (await r.json()).filter(m => !m.webhook_id && !m.author?.bot).sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  return msgs;
}

export async function ingest() {
  if (!canRead()) { console.log('ledger: no read token'); return; }
  await initLedger();
  for (const [channel, cid, hook] of [['buys', process.env.DISCORD_BUYS_CHANNEL_ID, process.env.DISCORD_BUYS_WEBHOOK_URL], ['sold', process.env.DISCORD_SOLD_CHANNEL_ID, process.env.DISCORD_SOLD_WEBHOOK_URL]]) {
    if (!cid) continue;
    const msgs = await readNew(cid, `last:${channel}`);
    for (const m of msgs) {
      const text = (m.content || '').trim();
      const p = parseQuick(text) || await parseSlow(text, channel);
      const who = m.author?.global_name || m.author?.username || 'someone';
      if (p && (channel === 'buys' ? p.action === 'bought' : true)) {
        const row = { event_id: null, action: p.action, qty: p.qty, unit_cost: p.action === 'bought' ? p.price : null, sale_price: p.action === 'sold' ? p.price : null, marketplace: p.marketplace || null, note: p.what, who, msg_id: m.id, channel, at: new Date(m.timestamp) };
        await sql`insert into picks ${sql(row)} on conflict (msg_id) do nothing`;
        const reply = p.action === 'bought' ? `✅ Logged for **${who}**: ${p.qty} × ${p.what} at ${money(p.price)} each (${money(p.qty * p.price)} in). List them within 48h; post the sale in #sold.` : `✅ Logged for **${who}**: ${p.qty} × ${p.what} sold at ${money(p.price)}${p.marketplace ? ` on ${p.marketplace}` : ''}. Board updated.`;
        if (hook && !(process.env.DRY && !process.env.POST)) await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'Ticketflip', content: reply }) });
      } else if (/^(bought|sold)/i.test(text) && hook && !(process.env.DRY && !process.env.POST)) {
        await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'Ticketflip', content: `❓ Couldn't read that, ${who}. Format: \`${channel === 'buys' ? 'bought 4 Interpol Philly 2/3 @ $62' : 'sold 2 Interpol Philly @ $140 StubHub'}\`` }) });
      }
      await kvSet(`last:${channel}`, m.id);
    }
  }
  await boards();
}

// Positions (open inventory) and Scoreboard (realized profit per person), as editable webhook messages.
export async function boards() {
  const rows = await sql`select who, action, qty, unit_cost, sale_price, marketplace, note, at from picks where who is not null order by at asc`;
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const pos = new Map(); // who|what → { qty, cost, listBy }
  const profit = new Map(); // who → { gross, net, sold, cost }
  for (const r of rows) {
    const key = `${r.who}|${norm(r.note).slice(0, 24)}`;
    if (r.action === 'bought') { const p = pos.get(key) || { who: r.who, what: r.note, qty: 0, cost: 0, since: r.at }; p.qty += r.qty; p.cost += r.qty * Number(r.unit_cost); pos.set(key, p); }
    else {
      const p = pos.get(key); const unit = p && p.qty ? p.cost / p.qty : null;
      const net = r.qty * Number(r.sale_price) * (1 - cfg.sellerFee) - (unit != null ? r.qty * unit : 0);
      const s = profit.get(r.who) || { sold: 0, gross: 0, net: 0, unknownCost: 0 }; s.sold += r.qty; s.gross += r.qty * Number(r.sale_price); s.net += net; if (unit == null) s.unknownCost += r.qty; profit.set(r.who, s);
      if (p) { p.qty -= r.qty; p.cost -= (unit || 0) * r.qty; if (p.qty <= 0) pos.delete(key); }
    }
  }
  const open = [...pos.values()].sort((a, b) => b.cost - a.cost);
  const positions = ['📦 **Positions — who is holding what**', open.length ? open.map(p => `• **${p.who}** — ${p.qty} × ${p.what} (${money(p.cost / Math.max(1, p.qty))} each, ${money(p.cost)} in) · bought <t:${Math.floor(new Date(p.since) / 1000)}:R>`).join('\n') : '_Nothing open. Post `bought 4 Act City date @ $price` when you buy._', '', `_${open.reduce((a, p) => a + p.qty, 0)} tickets, ${money(open.reduce((a, p) => a + p.cost, 0))} deployed. Updated <t:${Math.floor(Date.now() / 1000)}:R>._`].join('\n');
  const ranked = [...profit.entries()].sort((a, b) => b[1].net - a[1].net);
  const total = ranked.reduce((a, [, s]) => a + s.net, 0);
  const scoreboard = ['🏆 **Scoreboard — realized profit (after the ~15% marketplace cut)**', ranked.length ? ranked.map(([who, s], i) => `${['🥇', '🥈', '🥉'][i] || '•'} **${who}** — ${money(s.net)} net on ${s.sold} ticket${s.sold === 1 ? '' : 's'} (${money(s.gross)} gross)${s.unknownCost ? ` · ${s.unknownCost} sold without a matching buy post` : ''}`).join('\n') : '_No sales yet. Post `sold 2 Act City @ $price Marketplace` when one clears._', '', `_Group total ${money(total)}. Updated <t:${Math.floor(Date.now() / 1000)}:R>._`].join('\n');
  await upsertBoard('board:positions', process.env.DISCORD_BUYS_WEBHOOK_URL, positions);
  await upsertBoard('board:scoreboard', process.env.DISCORD_SOLD_WEBHOOK_URL, scoreboard);
}
async function upsertBoard(key, hook, content) {
  if (!hook || (process.env.DRY && !process.env.POST)) { console.log('[board off]', key); return; }
  const { id, token } = hookParts(hook);
  const mid = await kvGet(key);
  if (mid) { const r = await fetch(`https://discord.com/api/v9/webhooks/${id}/${token}/messages/${mid}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content }) }); if (r.ok) return; }
  const r = await fetch(`https://discord.com/api/v9/webhooks/${id}/${token}?wait=true`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'Ticketflip', content }) });
  const j = await r.json().catch(() => ({})); if (j.id) { await kvSet(key, j.id); await pin(hook, j.id); }
}
async function pin(hook, mid) {
  if (!canRead()) return;
  const cid = hook === process.env.DISCORD_BUYS_WEBHOOK_URL ? process.env.DISCORD_BUYS_CHANNEL_ID : process.env.DISCORD_SOLD_CHANNEL_ID;
  await fetch(`https://discord.com/api/v9/channels/${cid}/pins/${mid}`, { method: 'PUT', headers: H() }).catch(() => {});
}
