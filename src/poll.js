// Entry point. Every run: pull upcoming onsales, enrich new/stale ones, score, store, ping.
// `--digest` forces the daily digest; otherwise it fires once per day after DIGEST_HOUR local.
import { cfg } from './config.js';
import { upcomingOnsales, flatten } from './tm.js';
import * as sg from './seatgeek.js';
import { spotifyMonthlyListeners, instagramFollowers } from './signals.js';
import { score } from './score.js';
import { sql, init, upsertEvent, knownEvents, markPing, lastRun, logRun } from './db.js';
import { embed, post } from './discord.js';
import venues from '../data/venues.json' with { type: 'json' };

const STALE_MS = 6 * 3600e3;
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function enrich(f, prev) {
  const s = prev && Date.now() - new Date(prev.last_seen).getTime() < STALE_MS ? { ...prev.signals } : {};
  if (s.enrichedAt && Date.now() - s.enrichedAt < STALE_MS) return s;
  const local = venues.find(v => norm(v.name) === norm(f.venue.name) || (norm(v.name).includes(norm(f.venue.name)) && norm(v.city) === norm(f.venue.city)));
  const sgCap = local ? null : await sg.venueCapacity(f.venue.name, f.venue.city).catch(() => null);
  s.capacity = local?.capacity || sgCap || s.capacity || guessCapacity(f.venue.name);
  s.capacitySource = local ? 'table' : sgCap ? 'seatgeek' : 'guess';
  s.spotify = (await spotifyMonthlyListeners(f.attraction.spotify)) ?? s.spotify ?? null;
  s.instagram = (await instagramFollowers(f.attraction.instagram)) ?? s.instagram ?? null;
  // Secondary-market reality check on the same act's already-on-sale dates.
  try {
    const p = f.attraction.name ? await sg.performer(f.attraction.name) : null;
    if (p) {
      const evs = (await sg.performerEvents(p.id)).filter(e => e.listings && e.low);
      const face = f.faceMin || null;
      const prem = face ? evs.map(e => (e.median || e.avg || e.low) / face).filter(x => x > 0) : [];
      s.sg = { performerScore: p.score, upcoming: p.upcoming, events: evs.length, listings: evs.length ? Math.round(evs.reduce((a, e) => a + e.listings, 0) / evs.length) : 0, low: evs.length ? Math.min(...evs.map(e => e.low)) : null, observedPremium: prem.length ? median(prem) : null };
    }
  } catch (e) { s.sgError = e.message; }
  s.enrichedAt = Date.now();
  return s;
}
// Rough capacity from the venue's name when it's not in the table and SeatGeek is off.
function guessCapacity(name = '') {
  const n = name.toLowerCase();
  if (/stadium|speedway|bowl\b|field\b/.test(n)) return 50000;
  if (/amphitheat|pavilion|lawn|shed/.test(n)) return 12000;
  if (/arena|coliseum|colosseum|garden|dome|fieldhouse|civic center|convention/.test(n)) return 14000;
  if (/\bcenter\b|centre/.test(n)) return 6000;
  if (/casino|resort|fairground|expo|park\b|plaza/.test(n)) return 3000;
  if (/theat|hall|auditorium|opera|playhouse|palace|orpheum|fillmore|paramount|wiltern|ryman|tabernacle|music box/.test(n)) return 2200;
  if (/ballroom|showbox|warehouse|complex|factory/.test(n)) return 1500;
  if (/club|lounge|bar\b|cafe|room\b|garage|saloon|tavern|pub\b|basement|cellar|brewery|underground|social|house of blues/.test(n)) return 600;
  return 1200;
}
const scoredCap = (f, sc) => (sc.notes.find(n => /venue|arena|stadium/.test(n)) || '').replace(/\D+/g, '').slice(0, 6);
const median = (a) => { const b = [...a].sort((x, y) => x - y); return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2; };

function localHour() { return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: cfg.tz }).format(new Date())); }
function localDay(d = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: cfg.tz }).format(d); }

async function main() {
  await init();
  const raw = await upcomingOnsales();
  const flats = raw.map(flatten);
  const known = await knownEvents(flats.map(f => f.id));
  const scored = [];
  const sigStats = { table: 0, seatgeek: 0, guess: 0, spotify: 0, instagram: 0 };
  for (const f of flats) {
    const prev = known.get(f.id);
    const signals = await enrich(f, prev);
    sigStats[signals.capacitySource] = (sigStats[signals.capacitySource] || 0) + 1; if (signals.spotify) sigStats.spotify++; if (signals.instagram) sigStats.instagram++;
    const sc = score(f, signals);
    await upsertEvent(f, signals, sc);
    scored.push({ f, sc, prev });
  }
  await logRun('poll', { events: scored.length, buy: scored.filter(x => x.sc.verdict === 'BUY').length });

  // Instant ping: a NEW event that scores BUY (so he can register for Verified Fan / card presales early).
  const fresh = scored.filter(x => !x.prev && x.sc.verdict === 'BUY');
  if (fresh.length) await post({ content: `🆕 ${fresh.length} new BUY-grade onsale${fresh.length > 1 ? 's' : ''} spotted`, embeds: fresh.slice(0, 10).map(x => embed(x.f, x.sc)) });

  // Timed pings on BUY/WATCH events: 24h before and 15 min before the first presale (or public onsale if none).
  const now = Date.now();
  for (const { f, sc } of scored) {
    if (sc.verdict === 'SKIP') continue;
    const first = [...f.presales.map(p => p.start), f.onsale].filter(Boolean).map(d => new Date(d).getTime()).sort()[0];
    if (!first) continue;
    const row = (await sql`select ping_24h, ping_15m from events where id = ${f.id}`)[0] || {};
    const dt = first - now;
    if (!row.ping_24h && dt > 0 && dt <= 25 * 3600e3 && dt > 1 * 3600e3) { await post({ content: `⏰ Tomorrow: ${f.name}`, embeds: [embed(f, sc, { title: `24h · ${sc.verdict} · ${f.name}` })] }); await markPing(f.id, 'ping_24h'); }
    if (!row.ping_15m && dt > 0 && dt <= 20 * 60e3) { await post({ content: `🚨 **Presale opens in ${Math.round(dt / 60e3)} min** — ${f.name}\n${f.presales[0]?.url || f.url}`, embeds: [embed(f, sc, { title: `GO · ${sc.verdict} · ${f.name}` })] }); await markPing(f.id, 'ping_15m'); }
  }

  // Daily digest: top 10 by ROI among BUY/WATCH with a sale in the next 7 days.
  const forced = process.argv.includes('--digest');
  const last = await lastRun('digest');
  if (forced || (localHour() >= cfg.digestHourLocal && (!last || localDay(last) !== localDay()))) {
    const week = scored.filter(x => x.sc.verdict !== 'SKIP').sort((a, b) => b.sc.roi - a.sc.roi).slice(0, 10);
    const skipped = scored.length - week.length;
    await post({ content: `☀️ **Ticketflip digest ${localDay()}** — ${scored.length} onsales in the next ${cfg.horizonDays} days, ${week.length} worth a look, ${skipped} skipped. Bankroll $${cfg.bankroll}.`, embeds: week.map(x => embed(x.f, x.sc)) });
    await logRun('digest', { shown: week.length });
  }
  if (process.env.DRY) {
    const top = scored.filter(x => x.sc.verdict !== 'SKIP').sort((a, b) => b.sc.roi - a.sc.roi).slice(0, 25);
    console.table(top.map(({ f, sc }) => ({ verdict: sc.verdict, event: f.name.slice(0, 34), venue: `${f.venue.name || ''}`.slice(0, 22), cap: scoredCap(f, sc), face: sc.face + (sc.faceEst ? '~' : ''), sell: sc.sell, roi: sc.roi, conf: sc.confidence, first: (f.presales[0]?.start || f.onsale || '').slice(0, 16), flags: sc.flags.join(';').slice(0, 30) })));
    const have = (k) => scored.filter(x => x.prev?.signals?.[k] ?? x.sc[k] ?? null).length;
    const sigs = { capacityTable: 0, capacitySG: 0, capacityGuess: 0, spotify: 0, instagram: 0, faceKnown: 0 };
    for (const { f, sc } of scored) { if (f.faceMin != null) sigs.faceKnown++; }
    console.log('signals:', JSON.stringify(sigStats), 'faceKnown', sigs.faceKnown, '/', scored.length);
    const skips = {}; for (const { sc } of scored) if (sc.verdict === 'SKIP') for (const fl of (sc.flags.length ? sc.flags : ['low roi'])) skips[fl.split(' ')[0]] = (skips[fl.split(' ')[0]] || 0) + 1;
    console.log('skip reasons:', skips);
  }
  await sql.end();
  console.log(`poll ok: ${scored.length} events, ${scored.filter(x => x.sc.verdict === 'BUY').length} BUY, ${scored.filter(x => x.sc.verdict === 'WATCH').length} WATCH`);
}
main().catch(async (e) => { console.error(e); try { await sql.end(); } catch {} process.exit(1); });
