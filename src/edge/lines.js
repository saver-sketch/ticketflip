// Football lines board: every NFL + college game on Kalshi in the next 7 days, both sides as win %, Polymarket's number next to it.
// Posted once as a bot message in #kalshi and edited in place every run, so the channel doesn't fill up.
import { markets } from '../kalshi.js';
import { sql } from '../db.js';

const SERIES = { KXNFLGAME: 'NFL', KXNCAAFGAME: 'CFB' };
const MONTHS = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
// KXNFLGAME-26NOV01PHIWAS + markets ending -PHI / -WAS → away PHI, home WAS (the codes are concatenated, so split using the market suffixes).
const parse = (ev, mkts) => { const m = ev.match(/-(\d{2})([A-Z]{3})(\d{2})([A-Z]+)$/); if (!m) return null; const codes = mkts.map(x => x.ticker.split('-').pop()); const away = codes.find(c => m[4].startsWith(c) && codes.includes(m[4].slice(c.length))); if (!away) return null; return { date: `20${m[1]}-${MONTHS[m[2]]}-${m[3]}`, away, home: m[4].slice(away.length) }; };
const mid = (m) => m.yesBid != null && m.yesAsk != null ? (m.yesBid + m.yesAsk) / 2 : m.last ?? null;
async function poly(league, g) {
  for (const slug of [`${league}-${g.away}-${g.home}-${g.date}`, `${league}-${g.home}-${g.away}-${g.date}`].map(s => s.toLowerCase())) {
    const j = await (await fetch(`https://gamma-api.polymarket.com/events?slug=${slug}`)).json().catch(() => []);
    const ev = Array.isArray(j) ? j[0] : null; if (!ev) continue;
    const ml = (ev.markets || []).find(m => m.question === ev.title) || (ev.markets || [])[0]; if (!ml) continue;
    const codes = slug.split('-').slice(1, 3), prices = JSON.parse(ml.outcomePrices || '[]').map(Number);
    return { byCode: Object.fromEntries(codes.map((c, i) => [c.toUpperCase(), prices[i]])), liq: ml.liquidityNum || 0 };
  }
  return null;
}
export async function footballLines({ days = 8 } = {}) {
  const rows = [];
  for (const [series, league] of Object.entries(SERIES)) {
    let ms; try { ms = await markets(series); } catch { continue; }
    const byEvent = new Map(); for (const m of ms) { if (!byEvent.has(m.event)) byEvent.set(m.event, []); byEvent.get(m.event).push(m); }
    for (const [ev, mkts] of byEvent) {
      const g = parse(ev, mkts); if (!g || mkts.length < 2) continue;
      const gameDay = new Date(g.date + 'T23:59:00-05:00'); if ((gameDay - Date.now()) / 864e5 > days || gameDay < Date.now()) continue;
      const side = (code) => mkts.find(m => m.ticker.endsWith('-' + code));
      const a = side(g.away), h = side(g.home); if (!a || !h) continue;
      const pa = mid(a), ph = mid(h); if (pa == null || ph == null) continue;
      const s = pa + ph; const fa = pa / s, fh = ph / s; // devig the two Kalshi sides
      let pm = null; try { pm = await poly(league === 'NFL' ? 'nfl' : 'cfb', g); } catch {}
      const polyA = pm?.byCode[g.away], polyH = pm?.byCode[g.home];
      const gap = polyA != null ? Math.max(Math.abs(polyA - fa), Math.abs(polyH - fh)) : null;
      rows.push({ league, date: g.date, away: g.away, home: g.home, awayName: a.yesSub, homeName: h.yesSub, kalshiA: fa, kalshiH: fh, askA: a.yesAsk, askH: h.yesAsk, polyA, polyH, gap, liq: pm?.liq || 0, vol: (a.volume || 0) + (h.volume || 0) });
    }
  }
  return rows.sort((x, y) => x.date.localeCompare(y.date) || y.vol - x.vol);
}
const NFL = { ARI: 'Cardinals', ATL: 'Falcons', BAL: 'Ravens', BUF: 'Bills', CAR: 'Panthers', CHI: 'Bears', CIN: 'Bengals', CLE: 'Browns', DAL: 'Cowboys', DEN: 'Broncos', DET: 'Lions', GB: 'Packers', HOU: 'Texans', IND: 'Colts', JAC: 'Jaguars', JAX: 'Jaguars', KC: 'Chiefs', LAC: 'Chargers', LAR: 'Rams', LV: 'Raiders', MIA: 'Dolphins', MIN: 'Vikings', NE: 'Patriots', NO: 'Saints', NYG: 'Giants', NYJ: 'Jets', PHI: 'Eagles', PIT: 'Steelers', SEA: 'Seahawks', SF: '49ers', TB: 'Buccaneers', TEN: 'Titans', WAS: 'Commanders' };
const name = (r, side) => r.league === 'NFL' ? (NFL[side === 'away' ? r.away : r.home] || (side === 'away' ? r.awayName : r.homeName)) : (side === 'away' ? r.awayName : r.homeName);
const pct = (p) => p == null ? '—' : `${Math.round(p * 100)}%`;
export function linesEmbed(rows, league) {
  let list = rows.filter(r => r.league === league);
  if (league === 'CFB') list = [...list].sort((a, b) => b.vol - a.vol).slice(0, 15).sort((a, b) => a.date.localeCompare(b.date)); // biggest games only
  const lines = list.map(r => {
    const d = new Date(r.date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
    const tag = r.gap == null ? '' : r.gap >= 0.04 ? '  🟢' : '';
    return `${d} · **${name(r, 'away')}** ${pct(r.kalshiA)} @ **${name(r, 'home')}** ${pct(r.kalshiH)}${tag}`;
  });
  return { title: league === 'NFL' ? '🏈 NFL this week — win odds on Kalshi' : '🏈 College football — biggest games on Kalshi', color: 0x5865f2, description: (lines.join('\n') || '_No games on Kalshi in the next 7 days._').slice(0, 4000), footer: { text: '% = chance to win, from Kalshi prices · 🟢 = bot sees an edge, card posted below · refreshes every 15 min' }, timestamp: new Date().toISOString() };
}
// Post once, then edit the same message every run (bot token). Message ids live in kv.
export async function upsertLinesBoard() {
  const tok = process.env.DISCORD_BOT_TOKEN, ch = process.env.DISCORD_KALSHI_CHANNEL_ID;
  if (!tok || !ch || (process.env.DRY && !process.env.POST)) { console.log('[lines board off]'); return; }
  await sql`create table if not exists kv (k text primary key, v text)`;
  const rows = await footballLines();
  for (const league of ['NFL', 'CFB']) {
    const embed = linesEmbed(rows, league);
    const key = `board:lines:${league}`;
    const [row] = await sql`select v from kv where k = ${key}`;
    const H = { authorization: `Bot ${tok}`, 'content-type': 'application/json' };
    if (row?.v) { const r = await fetch(`https://discord.com/api/v10/channels/${ch}/messages/${row.v}`, { method: 'PATCH', headers: H, body: JSON.stringify({ embeds: [embed] }) }); if (r.ok) continue; }
    const r = await fetch(`https://discord.com/api/v10/channels/${ch}/messages`, { method: 'POST', headers: H, body: JSON.stringify({ embeds: [embed] }) });
    const j = await r.json().catch(() => ({}));
    if (j.id) { await sql`insert into kv (k, v) values (${key}, ${j.id}) on conflict (k) do update set v = excluded.v`; await fetch(`https://discord.com/api/v10/channels/${ch}/pins/${j.id}`, { method: 'PUT', headers: H }).catch(() => {}); }
  }
  console.log(`lines board: ${rows.length} games`);
}
