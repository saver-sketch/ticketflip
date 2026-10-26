// Sanity check before money moves: for acts already on sale, compare our predicted premium
// (tiers only, no SeatGeek cross-check) with what SeatGeek shows today.
import { tmGet, flatten } from './tm.js';
import * as sg from './seatgeek.js';
import { spotifyMonthlyListeners } from './signals.js';
import { score } from './score.js';
import venues from '../data/venues.json' with { type: 'json' };
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const n = Number(process.argv[2] || 15);
const j = await tmGet('/events.json', { countryCode: 'US', classificationName: 'Music', size: 200, sort: 'date,asc', startDateTime: new Date(Date.now() + 20 * 864e5).toISOString().replace(/\.\d{3}Z$/, 'Z') });
const evs = (j._embedded?.events || []).map(flatten).filter(f => f.faceMin && f.attraction.name);
const rows = [];
for (const f of evs.slice(0, n * 3)) {
  if (rows.length >= n) break;
  const p = await sg.performer(f.attraction.name); if (!p) continue;
  const sge = (await sg.performerEvents(p.id)).filter(e => e.listings && e.low && norm(e.venue) === norm(f.venue.name));
  if (!sge.length) continue;
  const local = venues.find(v => norm(v.name) === norm(f.venue.name));
  const s = { capacity: local?.capacity || sge[0].capacity || null, spotify: await spotifyMonthlyListeners(f.attraction.spotify) };
  const sc = score(f, s);
  const actual = (sge[0].median || sge[0].avg || sge[0].low) / f.faceMin;
  rows.push({ event: f.name.slice(0, 40), venue: f.venue.name.slice(0, 24), face: f.faceMin, predicted: sc.premium, actual: Math.round(actual * 100) / 100, listings: sge[0].listings, verdict: sc.verdict });
}
console.table(rows);
const err = rows.map(r => Math.abs(r.predicted - r.actual));
console.log(`mean abs error ${(err.reduce((a, b) => a + b, 0) / (err.length || 1)).toFixed(2)}× over ${rows.length} events`);
