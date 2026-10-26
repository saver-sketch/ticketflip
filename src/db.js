// Postgres store. Run `node src/db.js --init` once to create tables.
import postgres from 'postgres';
import { cfg } from './config.js';
export const sql = postgres(cfg.dbUrl(), { ssl: process.env.PGSSL === 'off' ? false : 'prefer', max: 3, idle_timeout: 10 });

export async function init() {
  await sql`create table if not exists events (
    id text primary key, name text, url text, segment text, genre text, subgenre text,
    event_date timestamptz, onsale timestamptz, first_presale timestamptz, presales jsonb,
    face_min numeric, face_max numeric, ticket_limit int, note text,
    venue jsonb, attraction jsonb, promoter text,
    signals jsonb, score jsonb, verdict text,
    first_seen timestamptz default now(), last_seen timestamptz default now(),
    ping_digest boolean default false, ping_24h boolean default false, ping_15m boolean default false
  )`;
  await sql`create table if not exists snapshots (
    id bigserial primary key, event_id text, taken timestamptz default now(),
    face_min numeric, face_max numeric, status text, sg jsonb
  )`;
  await sql`create table if not exists picks (
    id bigserial primary key, event_id text, action text, qty int, unit_cost numeric, list_price numeric, sale_price numeric,
    marketplace text, note text, at timestamptz default now()
  )`;
  await sql`create table if not exists runs (id bigserial primary key, kind text, at timestamptz default now(), info jsonb)`;
  await sql`create index if not exists events_onsale on events(onsale)`;
}

export async function upsertEvent(f, signals, score) {
  const firstPresale = f.presales.map(p => p.start).filter(Boolean).sort()[0] || null;
  const row = {
    id: f.id, name: f.name, url: f.url, segment: f.segment, genre: f.genre, subgenre: f.subgenre,
    event_date: f.eventDate, onsale: f.onsale, first_presale: firstPresale, presales: sql.json(f.presales),
    face_min: f.faceMin, face_max: f.faceMax, ticket_limit: f.ticketLimit, note: f.note,
    venue: sql.json(f.venue), attraction: sql.json(f.attraction), promoter: f.promoter,
    signals: sql.json(signals), score: sql.json(score), verdict: score.verdict, last_seen: new Date(),
  };
  await sql`insert into events ${sql(row)} on conflict (id) do update set ${sql(row, 'name','url','event_date','onsale','first_presale','presales','face_min','face_max','ticket_limit','note','venue','attraction','signals','score','verdict','last_seen')}`;
  await sql`insert into snapshots ${sql({ event_id: f.id, face_min: f.faceMin, face_max: f.faceMax, status: f.status, sg: sql.json(signals.sg || null) })}`;
}
export async function knownEvents(ids) {
  if (!ids.length) return new Map();
  const rows = await sql`select id, signals, score, last_seen from events where id in ${sql(ids)}`;
  return new Map(rows.map(r => [r.id, r]));
}
export async function markPing(id, col) { await sql`update events set ${sql({ [col]: true })} where id = ${id}`; }
export async function lastRun(kind) { const [r] = await sql`select at from runs where kind = ${kind} order by at desc limit 1`; return r?.at || null; }
export async function logRun(kind, info) { await sql`insert into runs ${sql({ kind, info: sql.json(info) })}`; }

if (process.argv.includes('--init')) { await init(); console.log('db ready'); await sql.end(); }
