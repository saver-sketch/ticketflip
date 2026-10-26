// Discord output. One card per pick, written for someone who has never flipped a ticket.
import { cfg } from './config.js';
const COLOR = { BUY: 0x2ecc71, WATCH: 0xf1c40f, SKIP: 0x95a5a6 };
const money = (n) => n == null ? '—' : `$${Math.round(Number(n))}`;
const ts = (iso, style = 'f') => iso && new Date(iso).getFullYear() > 2000 ? `<t:${Math.floor(new Date(iso).getTime() / 1000)}:${style}>` : 'time TBD';
const day = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function card(ev, sc) {
  const icon = sc.verdict === 'BUY' ? '🎯 BUY' : sc.verdict === 'WATCH' ? '👀 WATCH' : '⏭️ SKIP';
  const title = cut(`${icon} · ${ev.attraction.name || ev.name} · ${ev.venue.city}${ev.venue.state ? ', ' + ev.venue.state : ''} · ${day(ev.localDate || ev.eventDate)}`, 250);
  const evidence = sc.label === 'Strong evidence' ? '🟢 Strong evidence' : sc.label === 'Some evidence' ? '🟡 Some evidence' : '⚪ Guess';
  const why = sc.why.slice(0, 3).map(w => `• ${w}`).join('\n') || '• Model estimate only.';
  const per = `Face ${money(sc.face)}${sc.faceEst ? ' (estimated, not published yet)' : ''} → you pay about **${money(sc.cost)}** all-in → expect to sell around **${money(sc.sell)}** → **${money(sc.net)} profit per ticket** after the marketplace cut.`;
  const stack = sc.qty ? `Buy ${sc.qty} (limit ${sc.limit}/account): ~**${money(sc.net * sc.qty)} profit** on ${money(sc.bankroll)} tied up for a few weeks.` : 'Face too high for the bankroll setting; buy 1–2 if you want in.';
  const buy = [
    ...sc.code.slice(0, 3).map(c => `**${c.name}** ${ts(c.start)} (${ts(c.start, 'R')})\n${c.url}\n${c.how}`),
    `**Public onsale** ${ts(ev.onsale)}\n${ev.url}`,
    sc.tier,
  ].join('\n');
  const sell = sc.sellRank.slice(0, 3).map((m, i) => `${i + 1}. **${m.name}** — ${m.why}\n${m.url}`).join('\n');
  const exit = `List within 48h at **${money(sc.exit.list)}**. Two weeks out, drop to **${money(sc.exit.mid)}**. Last 10 days, floor **${money(sc.exit.floor)}** (never below what you paid). Never hold past show day.`;
  const risk = sc.risks.slice(0, 3).map(r => `• ${r}`).join('\n') || '• Normal market risk.';
  const fields = [
    { name: '💡 Why this one', value: cut(why, 1000) },
    { name: '💵 The money', value: cut(`${per}\n${stack}`, 1000) },
    { name: '🛒 How to buy', value: cut(buy, 1024) },
    { name: '🏷️ Where to sell (ranked)', value: cut(sell, 1000) },
    { name: '🚪 Exit plan', value: cut(exit, 1000) },
    { name: '⚠️ What breaks it', value: cut(risk, 1000) },
  ];
  const footer = `${evidence} (${Math.round(sc.confidence * 100)}%) · ROI ${Math.round(sc.roi * 100)}%${sc.observed ? ` · comparable dates resell at ${sc.observed}× face` : ''}${sc.moreDates ? ` · +${sc.moreDates} more dates this tour` : ''} · ${ev.venue.name}`;
  return { title, url: ev.url, color: COLOR[sc.verdict] || COLOR.SKIP, description: cut(sc.verdict === 'BUY' ? 'Face price is published and comparable dates are reselling above it. This is the only kind of pick we call a BUY.' : sc.verdict === 'WATCH' ? (sc.buyIfFace ? `Price isn't out yet. It becomes a BUY if the cheapest tier is **${money(sc.buyIfFace)} or less** when it drops. We re-check every 15 minutes and ping #alerts.` : 'Decent setup, margin is thin. Only buy if you like the act or the room.') : '', 300), fields, footer: { text: cut(footer, 2048) } };
}

// Short alert for the 24h / 15-minute pings.
export function alert(ev, sc, kind) {
  const c = sc.code[0];
  const when = c ? c.start : ev.onsale;
  const head = kind === '15m' ? `🚨 **${Math.max(1, Math.round((new Date(when) - Date.now()) / 60e3))} minutes** — ${ev.attraction.name || ev.name} · ${ev.venue.city}` : `⏰ **Tomorrow** — ${ev.attraction.name || ev.name} · ${ev.venue.city}`;
  const lines = [head, `${c ? `${c.name} opens ${ts(when, 'F')}` : `Public onsale ${ts(when, 'F')}`} · ${c?.url || ev.url}`, c ? `🔑 ${c.how}` : '', `💵 pay ~${money(sc.cost)} → sell ~${money(sc.sell)} → ~${money(sc.net)}/ticket · buy ${sc.qty || 2} · ${sc.tier}`, `🏷️ sell on ${sc.sellRank[0].name} first`].filter(Boolean);
  return lines.join('\n');
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

// One message per card so each pick reads as its own post.
export async function post({ content = '', embeds = [], url }) {
  const hook = url || cfg.discordWebhook();
  if (!hook || silent()) { console.log('[discord off]', content.slice(0, 60), embeds.map(e => e.title)); return false; }
  if (content) { await send(hook, { content }); await new Promise(r => setTimeout(r, 700)); }
  for (const e of embeds) { await send(hook, { embeds: [e] }); await new Promise(r => setTimeout(r, 700)); }
  return true;
}
export async function say(url, content) { if (!url || silent()) { console.log('[discord off]', content.slice(0, 80)); return false; } return send(url, { content }); }

// Post as the bot (needs DISCORD_BOT_TOKEN and Send Messages in that channel). One message per embed.
export async function postAsBot(channelId, { content = '', embeds = [] }) {
  const tok = process.env.DISCORD_BOT_TOKEN;
  if (!tok || !channelId || silent()) { console.log('[bot off]', content.slice(0, 60), embeds.map(e => e.title)); return false; }
  const send = async (body) => { for (let i = 0; i < 4; i++) { const r = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, { method: 'POST', headers: { authorization: `Bot ${tok}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }); if (r.status === 429) { const j = await r.json().catch(() => ({})); await new Promise(res => setTimeout(res, (j.retry_after || 1) * 1000 + 250)); continue; } if (!r.ok) throw new Error(`discord bot ${r.status}: ${(await r.text()).slice(0, 160)}`); return; } };
  if (content) { await send({ content }); await new Promise(r => setTimeout(r, 600)); }
  for (const e of embeds) { await send({ embeds: [e] }); await new Promise(r => setTimeout(r, 600)); }
  return true;
}
