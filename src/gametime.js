// Gametime's open mobile API: real resale listings (price before fees, in cents) for events already on sale.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const BASE = 'https://mobile.gametime.co/v1';
async function get(path) { try { const r = await fetch(BASE + path, { headers: { 'user-agent': UA, accept: 'application/json' } }); return r.ok ? r.json() : null; } catch { return null; } }
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Upcoming events for an act (exact performer-name match) with the resale floor per event.
export async function performerEvents(name) {
  const j = await get(`/search?q=${encodeURIComponent(name)}`);
  const rows = (j?.events || []).filter(x => (x.performers || []).some(p => norm(p.name) === norm(name)) || norm(x.event?.name) === norm(name));
  return rows.map(x => ({ id: x.event.id, name: x.event.name, date: x.event.datetime_local, venue: x.venue?.name, city: x.venue?.city, floor: x.event.min_price?.prefee ? x.event.min_price.prefee / 100 : null, max: x.event.max_price?.prefee ? x.event.max_price.prefee / 100 : null }));
}
// Listing count + price distribution for one event.
export async function listings(eventId) {
  const j = await get(`/listings?event_id=${eventId}`);
  const prices = (j?.listings || []).map(l => l.price?.prefee).filter(Boolean).map(c => c / 100).sort((a, b) => a - b);
  if (!prices.length) return null;
  return { count: prices.length, low: prices[0], p25: prices[Math.floor(prices.length / 4)], median: prices[Math.floor(prices.length / 2)], high: prices[prices.length - 1] };
}
// Observed secondary market for an act: median listing across its on-sale dates, listing counts, floors.
export async function observed(name, { maxEvents = 3 } = {}) {
  const evs = await performerEvents(name);
  if (!evs.length) return null;
  const sample = evs.filter(e => e.floor).slice(0, maxEvents);
  const ls = [];
  for (const e of sample) { const l = await listings(e.id); if (l) ls.push({ ...e, ...l }); }
  if (!ls.length) return { events: evs.length, listings: 0, floor: Math.min(...evs.map(e => e.floor).filter(Boolean)) || null, median: null };
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  return { events: evs.length, sampled: ls.length, listings: Math.round(ls.reduce((a, l) => a + l.count, 0) / ls.length), floor: Math.min(...ls.map(l => l.low)), p25: med(ls.map(l => l.p25)), median: med(ls.map(l => l.median)), dates: ls.map(l => `${l.venue} ${String(l.date).slice(0, 10)}: ${l.count} listings from $${l.low}`) };
}
