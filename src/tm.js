// Ticketmaster Discovery API v2 client. Free key, 5,000 calls/day, 5 req/s.
import { cfg } from './config.js';
const BASE = 'https://app.ticketmaster.com/discovery/v2';
let last = 0;
async function throttle() { const wait = 250 - (Date.now() - last); if (wait > 0) await new Promise(r => setTimeout(r, wait)); last = Date.now(); }

export async function tmGet(path, params = {}) {
  await throttle();
  const u = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') u.searchParams.set(k, v);
  u.searchParams.set('apikey', cfg.tmKey());
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(u);
    if (r.status === 429) { await new Promise(res => setTimeout(res, 2000 * (attempt + 1))); continue; }
    if (!r.ok) throw new Error(`TM ${r.status} ${path}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }
  throw new Error(`TM rate-limited ${path}`);
}

const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

// Every US music + comedy event whose public onsale starts inside the horizon.
// Presale-only windows are caught because presales precede the public onsale.
export async function upcomingOnsales({ days = cfg.horizonDays, segments = ['Music', 'Arts & Theatre'] } = {}) {
  const now = new Date();
  const end = new Date(now.getTime() + days * 864e5);
  const out = new Map();
  for (const seg of segments) {
    for (let page = 0; page < 5; page++) { // deep-paging cap: size*page < 1000
      const j = await tmGet('/events.json', {
        countryCode: 'US', classificationName: seg, sort: 'onSaleStartDate,asc', size: 200, page,
        onsaleStartDateTime: iso(now), onsaleEndDateTime: iso(end),
      });
      const evs = j._embedded?.events || [];
      for (const e of evs) out.set(e.id, e);
      if (page + 1 >= (j.page?.totalPages || 0) || evs.length < 200) break;
    }
  }
  return [...out.values()];
}

export async function event(id) { return tmGet(`/events/${id}.json`); }
export async function attraction(id) { return tmGet(`/attractions/${id}.json`); }

// Flatten a Discovery event into what the scorer needs.
export function flatten(e) {
  const v = e._embedded?.venues?.[0] || {};
  const a = e._embedded?.attractions?.[0] || {};
  const cls = e.classifications?.[0] || {};
  const pr = e.priceRanges?.find(p => p.type === 'standard') || e.priceRanges?.[0];
  const presales = (e.sales?.presales || []).map(p => ({ name: p.name, description: p.description, start: p.startDateTime, end: p.endDateTime, url: p.url }));
  const limit = Number((e.ticketLimit?.info || '').match(/(\d+)\s*(?:\(\d+\)\s*)?ticket/i)?.[1] || (e.ticketLimit?.info || '').match(/\((\d+)\)/)?.[1] || 0);
  const text = [e.pleaseNote, e.info, e.ticketLimit?.info, ...presales.map(p => `${p.name} ${p.description}`)].filter(Boolean).join(' | ');
  const spotify = a.externalLinks?.spotify?.[0]?.url || '';
  const instagram = a.externalLinks?.instagram?.[0]?.url || '';
  return {
    id: e.id, name: e.name, url: e.url,
    segment: cls.segment?.name || '', genre: cls.genre?.name || '', subgenre: cls.subGenre?.name || '',
    eventDate: e.dates?.start?.dateTime || e.dates?.start?.localDate || null, localDate: e.dates?.start?.localDate || null,
    status: e.dates?.status?.code || '',
    onsale: e.sales?.public?.startDateTime || null, presales,
    faceMin: pr?.min ?? null, faceMax: pr?.max ?? null,
    ticketLimit: limit || null, note: text,
    venue: { id: v.id, name: v.name, city: v.city?.name, state: v.state?.stateCode, lat: Number(v.location?.latitude), lng: Number(v.location?.longitude) },
    attraction: { id: a.id, name: a.name, upcoming: a.upcomingEvents?._total ?? null, spotify, instagram, genre: a.classifications?.[0]?.genre?.name || '' },
    promoter: e.promoter?.name || '',
    raw: e,
  };
}
