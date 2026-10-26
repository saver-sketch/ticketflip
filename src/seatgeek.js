// SeatGeek platform API: live secondary-market stats + venue capacity + performer score.
import { cfg } from './config.js';
const BASE = 'https://api.seatgeek.com/2';
async function sg(path, params = {}) {
  const id = cfg.sgClientId(); if (!id) return null;
  const u = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') u.searchParams.set(k, v);
  u.searchParams.set('client_id', id);
  const r = await fetch(u);
  if (!r.ok) return null;
  return r.json();
}
export async function performer(name) {
  const j = await sg('/performers', { q: name, per_page: 3 });
  const p = j?.performers?.find(x => x.name.toLowerCase() === name.toLowerCase()) || j?.performers?.[0];
  return p ? { id: p.id, name: p.name, score: p.score, upcoming: p.num_upcoming_events, type: p.type, genres: (p.genres || []).map(g => g.name) } : null;
}
// Already-on-sale dates for this performer, with resale stats per event.
export async function performerEvents(performerId) {
  const j = await sg('/events', { 'performers.id': performerId, per_page: 50, sort: 'datetime_utc.asc' });
  return (j?.events || []).map(e => ({
    id: e.id, title: e.title, date: e.datetime_utc, venue: e.venue?.name, city: e.venue?.city, capacity: e.venue?.capacity || null,
    listings: e.stats?.listing_count ?? null, low: e.stats?.lowest_price ?? null, avg: e.stats?.average_price ?? null, high: e.stats?.highest_price ?? null, median: e.stats?.median_price ?? null,
  }));
}
export async function venueCapacity(name, city) {
  const j = await sg('/venues', { q: name, city, per_page: 3 });
  const v = j?.venues?.[0];
  return v?.capacity || null;
}
