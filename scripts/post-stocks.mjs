// Post stdin markdown to #stocks as one embed (or plain content if short). Usage: node scripts/post-stocks.mjs <<'EOF' ... EOF
import fs from 'node:fs';
const url = process.env.DISCORD_STOCKS_WEBHOOK_URL; if (!url) { console.error('no DISCORD_STOCKS_WEBHOOK_URL'); process.exit(1); }
const md = fs.readFileSync(0, 'utf8').trim(); if (!md) process.exit(0);
const title = md.split('\n')[0].replace(/\*\*/g, '').slice(0, 250);
const body = md.split('\n').slice(1).join('\n').trim();
const tag = /^🟢/.test(title) ? 0x2ecc71 : /^🟡/.test(title) ? 0xf1c40f : /^🔴/.test(title) ? 0xe74c3c : 0x5865f2;
const payload = body.length > 1800 || /^[🟢🟡🔴]/.test(title) ? { username: 'Ticketflip', embeds: [{ title, description: body.slice(0, 4000), color: tag }] } : { username: 'Ticketflip', content: md.slice(0, 1990) };
const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
console.log(r.ok ? 'posted' : `failed ${r.status} ${await r.text()}`);
