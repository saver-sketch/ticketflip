// Entry point. Every run: pull upcoming onsales, enrich new/stale ones, score, store, ping.
// `--digest` forces the daily digest; otherwise it fires once per day after DIGEST_HOUR local.
import { cfg } from './config.js';
import { upcomingOnsales, flatten } from './tm.js';
import * as sg from './seatgeek.js';
import * as gt from './gametime.js';
import { spotifyMonthlyListeners, instagramFollowers, deezerFans } from './signals.js';
import { score } from './score.js';
import { sql, init, upsertEvent, knownEvents, markPing, lastRun, logRun } from './db.js';
import { card, alert, post, say } from './discord.js';
import venues from '../data/venues.json' with { type: 'json' };

const STALE_MS = 6 * 3600e3;
const SIG_VERSION = 3; // bump when enrich() learns a new signal so cached rows re-enrich
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function enrich(f, prev) {
  const s = prev && Date.now() - new Date(prev.last_seen).getTime() < STALE_MS ? { ...prev.signals } : {};
  if (s.v === SIG_VERSION && s.enrichedAt && Date.now() - s.enrichedAt < STALE_MS) return s;
  const vn = norm(f.venue.name), vc = norm(f.venue.city);
  const local = venues.find(v => norm(v.name) === vn) || venues.find(v => norm(v.city) === vc && (norm(v.name).includes(vn) || vn.includes(norm(v.name))));
  const sgCap = local ? null : await sg.venueCapacity(f.venue.name, f.venue.city).catch(() => null);
  s.capacity = local?.capacity || sgCap || s.capacity || guessCapacity(f.venue.name);
  s.capacitySource = local ? 'table' : sgCap ? 'seatgeek' : 'guess';
  const dz = await deezerFans(f.attraction.name);
  s.fans = dz?.fans ?? s.fans ?? null; s.fansSource = dz ? 'deezer' : s.fansSource || null;
  // Secondary-market reality check on the same act's already-on-sale dates (Gametime listings).
  try {
    const o = f.attraction.name ? await gt.observed(f.attraction.name) : null;
    if (o) {
      const face = f.faceMin || null;
      s.resale = { ...o, observedPremium: face && o.p25 ? o.p25 / face : null, floorPremium: face && o.floor ? o.floor / face : null };
    } else s.resale = null;
  } catch (e) { s.resaleError = e.message; }
  s.enrichedAt = Date.now(); s.v = SIG_VERSION;
  return s;
}
// One line per act+venue: the digest shouldn't be nine rows of the same residency.
function dedupe(list) {
  const seen = new Map();
  const out = list.filter((x) => { const k = x.f.attraction.id || x.f.name; if (seen.has(k)) { seen.get(k).sc.moreDates = (seen.get(k).sc.moreDates || 0) + 1; return false; } seen.set(k, x); return true; });
  return out;
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
  const runCount = {};
  for (const f of flats) { const k = `${f.attraction.id}|${f.venue.id}`; runCount[k] = (runCount[k] || 0) + 1; }
  const scored = [];
  const sigStats = { table: 0, seatgeek: 0, guess: 0, fans: 0, resale: 0 };
  for (const f of flats) {
    const prev = known.get(f.id);
    const signals = await enrich(f, prev);
    signals.sameVenueDates = runCount[`${f.attraction.id}|${f.venue.id}`] || 1;
    sigStats[signals.capacitySource] = (sigStats[signals.capacitySource] || 0) + 1; if (signals.fans != null) sigStats.fans++; if (signals.resale?.median) sigStats.resale++;
    const sc = score(f, signals);
    await upsertEvent(f, signals, sc);
    scored.push({ f, sc, prev });
  }
  await logRun('poll', { events: scored.length, buy: scored.filter(x => x.sc.verdict === 'BUY').length });

  // Instant ping: a NEW event that scores BUY (so he can register for Verified Fan / card presales early).
  // Instant pings: new BUY-grade events only, never on a cold database, at most 5 per run.
  const fresh = known.size ? scored.filter(x => !x.prev && x.sc.verdict === 'BUY').slice(0, 5) : [];
  if (fresh.length) await post({ content: `🆕 New BUY-grade pick${fresh.length > 1 ? 's' : ''} just showed up (face price published + comparable dates reselling above it):`, embeds: dedupe(fresh).map(x => card(x.f, x.sc)) });

  // Timed pings on BUY/WATCH events: 24h before and 15 min before the first presale (or public onsale if none).
  const now = Date.now();
  let timed = 0;
  for (const { f, sc } of scored) {
    if (sc.verdict === 'SKIP' || timed >= 6) continue;
    const first = [...f.presales.map(p => p.start), f.onsale].filter(Boolean).map(d => new Date(d).getTime()).sort()[0];
    if (!first) continue;
    const row = (await sql`select ping_24h, ping_15m from events where id = ${f.id}`)[0] || {};
    const dt = first - now;
    if (sc.verdict !== 'BUY' && !(sc.verdict === 'WATCH' && sc.confidence >= 0.6)) continue; // alerts only for picks worth waking up for
    if (!row.ping_24h && dt > 0 && dt <= 25 * 3600e3 && dt > 1 * 3600e3) { await say(cfg.alertsWebhook(), alert(f, sc, '24h')); await markPing(f.id, 'ping_24h'); timed++; }
    if (!row.ping_15m && dt > 0 && dt <= 20 * 60e3) { await say(cfg.alertsWebhook(), alert(f, sc, '15m')); await markPing(f.id, 'ping_15m'); timed++; }
  }

  // Daily digest: top 10 by ROI among BUY/WATCH with a sale in the next 7 days.
  const forced = process.argv.includes('--digest');
  const last = await lastRun('digest');
  if (forced || (localHour() >= cfg.digestHourLocal && (!last || localDay(last) !== localDay()))) {
    const ranked = dedupe(scored.filter(x => x.sc.verdict !== 'SKIP').sort((a, b) => (b.sc.verdict === 'BUY') - (a.sc.verdict === 'BUY') || b.sc.confidence * b.sc.roi - a.sc.confidence * a.sc.roi));
    const week = ranked.slice(0, 5);
    const buys = scored.filter(x => x.sc.verdict === 'BUY').length, watch = scored.filter(x => x.sc.verdict === 'WATCH').length;
    const header = [`☀️ **Ticketflip daily — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: cfg.tz })}**`,
      `Scanned **${scored.length}** presales/onsales in the next ${cfg.horizonDays} days → **${buys} BUY**, **${watch} WATCH**, rest skipped. Top ${week.length} below, best first.`,
      buys ? '' : 'No BUYs today: a BUY needs the face price published **and** comparable dates already reselling above it. WATCH picks turn into BUYs as prices drop, and #alerts will ping you.',
      'New here? Read #start-here first. Numbers assume the cheapest tier, Ticketmaster fees of ~25% on the way in and a ~15% marketplace cut on the way out.'].filter(Boolean).join('\n');
    await post({ content: header, embeds: week.map(x => card(x.f, x.sc)) });
    await logRun('digest', { shown: week.length });
  }
  if (process.env.DRY) {
    const top = dedupe(scored.filter(x => x.sc.verdict !== 'SKIP').sort((a, b) => b.sc.roi - a.sc.roi)).slice(0, 25);
    console.table(top.map(({ f, sc }) => ({ verdict: sc.verdict, event: f.name.slice(0, 34), venue: `${f.venue.name || ''}`.slice(0, 22), cap: scoredCap(f, sc), resale: sc.observed ? `${sc.observed}x/${sc.listings}` : '-', fans: f.attraction.name ? (x => x == null ? '?' : x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : x >= 1e3 ? Math.round(x / 1e3) + 'K' : String(x))(sc.fans) : '-', face: sc.face + (sc.faceEst ? '~' : ''), sell: sc.sell, roi: sc.roi, conf: sc.confidence, first: (f.presales[0]?.start || f.onsale || '').slice(0, 16), flags: sc.flags.join(';').slice(0, 30) })));
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
