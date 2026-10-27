// Options-idea ledger stored as a JSON message in the hidden #desk-ledger channel (bot token). No database needed.
// add | list | close | scoreboard | json   — env: DISCORD_BOT_TOKEN, DISCORD_LEDGER_CHANNEL_ID
const TOK = process.env.DISCORD_BOT_TOKEN, CH = process.env.DISCORD_LEDGER_CHANNEL_ID;
if (!TOK || !CH) { console.error('need DISCORD_BOT_TOKEN and DISCORD_LEDGER_CHANNEL_ID'); process.exit(1); }
const H = { authorization: `Bot ${TOK}`, 'content-type': 'application/json' };
const api = async (p, init = {}) => { const r = await fetch('https://discord.com/api/v10' + p, { ...init, headers: H }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`discord ${r.status} ${JSON.stringify(j).slice(0, 120)}`); return j; };
async function load() {
  const pins = await api(`/channels/${CH}/pins`);
  const pin = (Array.isArray(pins) ? pins : pins.items?.map(x => x.message) || []).find(m => m.content?.startsWith('LEDGER'));
  if (!pin) return { msgId: null, ideas: [] };
  const m = pin.content.match(/```json\n([\s\S]*?)```/); return { msgId: pin.id, ideas: m ? JSON.parse(m[1]) : [] };
}
async function save(state, ideas) {
  const content = 'LEDGER (bot storage, do not edit)\n```json\n' + JSON.stringify(ideas) + '\n```';
  if (content.length > 1900) { const open = ideas.filter(i => i.status === 'open'); const closed = ideas.filter(i => i.status !== 'open').slice(-40); return save(state, [...closed, ...open]); }
  if (state.msgId) await api(`/channels/${CH}/messages/${state.msgId}`, { method: 'PATCH', body: JSON.stringify({ content }) });
  else { const m = await api(`/channels/${CH}/messages`, { method: 'POST', body: JSON.stringify({ content }) }); await api(`/channels/${CH}/pins/${m.id}`, { method: 'PUT' }); }
}
const args = Object.fromEntries(process.argv.slice(3).join(' ').split(/\s+--/).filter(Boolean).map(s => { const [k, ...v] = s.replace(/^--/, '').split(' '); return [k, v.join(' ').replace(/^"|"$/g, '')]; }));
const cmd = process.argv[2];
const state = await load(); const ideas = state.ideas;
if (cmd === 'add') {
  const id = (ideas.reduce((a, i) => Math.max(a, i.id), 0) || 0) + 1;
  const row = { id, posted: new Date().toISOString().slice(0, 10), ticker: (args.ticker || '').toUpperCase(), structure: args.structure, legs: args.legs, expiry: args.expiry, tag: args.tag || 'green', entry: Number(args.entry), target: Number(args.target), stop: Number(args.stop), exit: args.exit, catalyst: args.catalyst || '', thesis: (args.thesis || '').slice(0, 400), status: 'open' };
  ideas.push(row); await save(state, ideas); console.log(`recorded idea #${id} ${row.ticker} ${row.structure}`);
} else if (cmd === 'list') {
  const open = ideas.filter(i => i.status === 'open'); if (!open.length) console.log('no open ideas');
  for (const r of open) console.log(`#${r.id} ${r.ticker} ${r.structure} [${r.legs}] exp=${r.expiry} tag=${r.tag} entry=$${r.entry} target=$${r.target} stop=$${r.stop} out-by=${r.exit} catalyst=${r.catalyst || '-'} posted=${r.posted}`);
} else if (cmd === 'close') {
  const i = ideas.find(x => x.id === Number(args.id) && x.status === 'open'); if (!i) { console.error('no such open idea'); process.exit(1); }
  const price = Number(args.price); const risk = i.entry - i.stop; const r = risk > 0 ? (price - i.entry) / risk : null;
  Object.assign(i, { status: 'closed', closed: new Date().toISOString().slice(0, 10), close_price: price, result_r: r == null ? null : Math.round(r * 100) / 100, notes: args.notes || '' });
  await save(state, ideas); console.log(`closed #${i.id} ${i.ticker} at $${price} → ${r == null ? 'n/a' : r.toFixed(2) + 'R'}`);
} else if (cmd === 'scoreboard') {
  const closed = ideas.filter(i => i.status === 'closed' && i.result_r != null); const open = ideas.filter(i => i.status === 'open').length;
  const by = {}; for (const i of closed) { const t = by[i.tag] || { w: 0, l: 0, r: 0 }; if (i.result_r > 0) t.w++; else t.l++; t.r += i.result_r; by[i.tag] = t; }
  const w = closed.filter(i => i.result_r > 0).length, l = closed.length - w, avg = closed.length ? closed.reduce((a, i) => a + i.result_r, 0) / closed.length : 0;
  console.log(`${closed.length} closed · ${w}-${l} · avg ${avg.toFixed(2)}R · open ${open} · by tag: ${Object.entries(by).map(([t, x]) => `${t} ${x.w}-${x.l} (${(x.r / (x.w + x.l)).toFixed(2)}R)`).join(' · ') || 'none yet'}`);
} else if (cmd === 'json') { console.log(JSON.stringify(ideas)); }
else console.log('usage: idea.mjs add|list|close|scoreboard|json');
