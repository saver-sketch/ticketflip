// Discord output. Short, casual, action-first. Details live in the bot (@Ticketflip in #chat).
import { cfg } from './config.js';
const COLOR = { BUY: 0x2ecc71, WATCH: 0xf1c40f, SKIP: 0x95a5a6 };
const money = (n) => n == null ? '—' : `$${Math.round(Number(n))}`;
const ts = (iso, style = 'f') => iso && new Date(iso).getFullYear() > 2000 ? `<t:${Math.floor(new Date(iso).getTime() / 1000)}:${style}>` : 'time TBD';
const day = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// One pick = one short card.
export function card(ev, sc) {
  const act = ev.attraction.name || ev.name;
  const title = cut(`${sc.verdict === 'BUY' ? '🎯 BUY' : '👀 WATCH'} · ${act} · ${ev.venue.city} · ${day(ev.localDate || ev.eventDate)}`, 250);
  const c = sc.code[0];
  const when = c ? `${c.name} ${ts(c.start)}` : `onsale ${ts(ev.onsale)}`;
  const why = sc.why[0] ? sc.why[0].replace(/^Real evidence: /, '') : 'Small room, real fanbase.';
  const lines = [
    sc.verdict === 'BUY'
      ? `**Buy** cheapest tier, ${money(sc.cost)} each all-in, up to ${sc.limit} per account.`
      : `**Buy if the cheapest tier is ${money(sc.buyIfFace || sc.face)} or less**, up to ${sc.limit} per account.`,
    `**When:** ${when}${c?.how ? `\n**Code:** ${cut(c.how, 160)}` : ''}`,
    `**Link:** ${c?.url || ev.url}`,
    `**Sell:** ${sc.sellRank[0].name} at ~${money(sc.sell)} within 48h → ~${money(sc.net)} profit each.`,
    `**Why:** ${cut(why, 220)}`,
    `_More? Ask @Ticketflip "tell me about ${act}" in #chat._`,
  ];
  return { title, url: ev.url, color: COLOR[sc.verdict] || COLOR.SKIP, description: cut(lines.join('\n'), 1500), footer: { text: `${ev.venue.name} · ${sc.label} · limit ${sc.limit}/account${sc.moreDates ? ` · +${sc.moreDates} more dates` : ''}` } };
}

// 24h / 15-min pings: one message, straight to the point.
export function alert(ev, sc, kind) {
  const c = sc.code[0]; const when = c ? c.start : ev.onsale; const act = ev.attraction.name || ev.name;
  return [
    kind === '15m' ? `🚨 **${act} · ${ev.venue.city} — opens in ${Math.max(1, Math.round((new Date(when) - Date.now()) / 60e3))} min**` : `⏰ **${act} · ${ev.venue.city} — tomorrow ${ts(when, 't')}**`,
    `Cheapest tier, ~${money(sc.cost)} each (limit ${sc.limit}) → sell on ${sc.sellRank[0].name} at ~${money(sc.sell)}.`,
    `${c?.url || ev.url}`,
    c?.how ? `Code: ${cut(c.how, 140)}` : '',
  ].filter(Boolean).join('\n');
}

async function send(url, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'Ticketflip', ...body }) });
    if (r.status === 429) { const j = await r.json().catch(() => ({})); await new Promise(res => setTimeout(res, Math.ceil((j.retry_after || 1) * 1000) + 250)); continue; }
    if (!r.ok) throw new Error(`discord ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return true;
  }
  return false;
}
const silent = () => !!process.env.DRY && !process.env.POST;
export async function post({ content = '', embeds = [], url }) {
  const hook = url || cfg.discordWebhook();
  if (!hook || silent()) { console.log('[discord off]', content.slice(0, 60), embeds.map(e => e.title)); return false; }
  if (content) { await send(hook, { content }); await new Promise(r => setTimeout(r, 700)); }
  for (const e of embeds) { await send(hook, { embeds: [e] }); await new Promise(r => setTimeout(r, 700)); }
  return true;
}
export async function say(url, content) { if (!url || silent()) { console.log('[discord off]', content.slice(0, 80)); return false; } return send(url, { content }); }
export async function postAsBot(channelId, { content = '', embeds = [] }) {
  const tok = process.env.DISCORD_BOT_TOKEN;
  if (!tok || !channelId || silent()) { console.log('[bot off]', content.slice(0, 60), embeds.map(e => e.title)); return false; }
  const sendB = async (body) => { for (let i = 0; i < 4; i++) { const r = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, { method: 'POST', headers: { authorization: `Bot ${tok}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }); if (r.status === 429) { const j = await r.json().catch(() => ({})); await new Promise(res => setTimeout(res, (j.retry_after || 1) * 1000 + 250)); continue; } if (!r.ok) throw new Error(`discord bot ${r.status}: ${(await r.text()).slice(0, 160)}`); return; } };
  if (content) { await sendB({ content }); await new Promise(r => setTimeout(r, 600)); }
  for (const e of embeds) { await sendB({ embeds: [e] }); await new Promise(r => setTimeout(r, 600)); }
  return true;
}
