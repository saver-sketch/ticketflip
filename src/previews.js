// Daily game previews for #kalshi-sports: every NFL game kicking off in the next 36h (plus the 3 biggest college games),
// written by the analyst with the same research the chat bot uses. Runs once a day (first cron run after PREVIEW_HOUR local).
import { analyze } from './analyst.js';
import { footballLines } from './edge/lines.js';
import { postAsBot } from './discord.js';
import { sql, lastRun, logRun } from './db.js';
import { cfg } from './config.js';

const localDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: cfg.tz }).format(d);
const localHour = () => Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: cfg.tz }).format(new Date()));

export async function previews({ force = false } = {}) {
  const hour = Number(process.env.PREVIEW_HOUR || 7);
  const last = await lastRun('previews');
  if (!force && !(localHour() >= hour && (!last || localDay(last) !== localDay()))) return;
  const rows = await footballLines({ days: 2 });
  const today = localDay(), tomorrow = localDay(new Date(Date.now() + 864e5));
  const nfl = rows.filter(r => r.league === 'NFL' && (r.date === today || r.date === tomorrow));
  const games = nfl; // NFL only (college previews cost more than they're worth); ask the bot in #chat for any college game
  if (!games.length) { await logRun('previews', { games: 0 }); return; }
  const ch = process.env.DISCORD_KALSHI_CHANNEL_ID;
  await postAsBot(ch, { content: `🏈 **Game previews for ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: cfg.tz })}** — ${games.length} game${games.length > 1 ? 's' : ''} in the next day. Kalshi's number, my number, and why. Ask @Ticketflip in #chat for more on any of them.` });
  let done = 0;
  for (const g of games) {
    try {
      const q = `Preview ${g.awayName} at ${g.homeName} (${g.league === 'NFL' ? 'NFL' : 'college football'}, ${g.date}). Use game_report (league "${g.league === 'NFL' ? 'nfl' : 'cfb'}", teams "${g.awayName} ${g.homeName}") and at most one web_search for injury news. Follow the standard shape, under 180 words.`;
      const text = await analyze({ question: q, log: () => {} });
      await postAsBot(ch, { embeds: [{ title: `${g.awayName} @ ${g.homeName} · ${g.date}`, color: 0x5865f2, description: text.slice(0, 4000), footer: { text: 'preview · Kalshi % is the market, "my call" is the bot\'s reasoning · not an order' } }] });
      done++;
    } catch (e) { console.error('preview', g.awayName, e.message); }
  }
  await logRun('previews', { games: done });
  console.log(`previews: ${done}/${games.length}`);
}
if (process.argv[1] && /previews\.js$/.test(process.argv[1])) { await previews({ force: true }); await sql.end(); }
