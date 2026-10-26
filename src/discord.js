// Discord webhook output. One embed per event; colour = verdict.
import { cfg } from './config.js';
const COLOR = { BUY: 0x2ecc71, WATCH: 0xf1c40f, SKIP: 0x95a5a6 };
const money = (n) => n == null ? '—' : `$${Number(n).toFixed(0)}`;
const pct = (n) => `${Math.round(n * 100)}%`;
const when = (iso) => iso ? `<t:${Math.floor(new Date(iso).getTime() / 1000)}:f> (<t:${Math.floor(new Date(iso).getTime() / 1000)}:R>)` : '—';

export function embed(ev, sc, { title } = {}) {
  const pres = (ev.presales || []).slice(0, 4).map(p => `• **${p.name}** ${when(p.start)}`).join('\n') || '• no presale listed';
  const lines = [
    `**${ev.venue.name}**, ${ev.venue.city} ${ev.venue.state} · ${ev.localDate || ''}`,
    `Face ${money(ev.faceMin)}–${money(ev.faceMax)} · limit ${ev.ticketLimit || '?'}/account`,
    '',
    pres,
    `• **Public onsale** ${when(ev.onsale)}`,
    '',
    `**Cost/ticket ${money(sc.cost)} → sell ${money(sc.sell)} → net ${money(sc.net)} (ROI ${pct(sc.roi)})** · confidence ${pct(sc.confidence)}`,
    `Buy ${sc.qty} · ${sc.sellAt}` + (sc.moreDates ? ` · **+${sc.moreDates} more date${sc.moreDates > 1 ? 's' : ''} this tour**` : ''),
    sc.flags.length ? `⚠️ ${sc.flags.join(' · ')}` : '',
    sc.notes.length ? `_${sc.notes.join(' · ')}_` : '',
  ].filter(l => l !== undefined);
  return { title: title || `${sc.verdict} · ${ev.name}`, url: ev.url, color: COLOR[sc.verdict] || COLOR.SKIP, description: lines.join('\n').slice(0, 900) };
}

export async function post({ content = '', embeds = [] }) {
  const url = cfg.discordWebhook();
  if (!url || (process.env.DRY && !process.env.POST)) { console.log('[discord off]', content, embeds.map(e => e.title)); return false; }
  for (let i = 0; i < embeds.length || i === 0; i += 5) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: i === 0 ? content : '', embeds: embeds.slice(i, i + 5), username: 'Ticketflip' }) });
      if (r.status === 429) { const j = await r.json().catch(() => ({})); await new Promise(res => setTimeout(res, Math.ceil((j.retry_after || 1) * 1000) + 250)); continue; }
      if (!r.ok) throw new Error(`discord ${r.status}: ${(await r.text()).slice(0, 200)}`);
      break;
    }
    await new Promise(res => setTimeout(res, 600)); // stay under the webhook's 30/min
    if (embeds.length <= 5) break;
  }
  return true;
}
