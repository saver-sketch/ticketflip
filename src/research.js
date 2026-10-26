// Game research from ESPN's public endpoints + Kalshi odds. No keys.
import { markets } from './kalshi.js';
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports';
const LEAGUES = { nfl: 'football/nfl', cfb: 'football/college-football', nba: 'basketball/nba', nhl: 'hockey/nhl', mlb: 'baseball/mlb' };
const KALSHI = { nfl: 'KXNFLGAME', cfb: 'KXNCAAFGAME', nba: 'KXNBAGAME', nhl: 'KXNHLGAME', mlb: 'KXMLBGAME' };
const get = async (u) => { const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0' } }); if (!r.ok) throw new Error(`espn ${r.status}`); return r.json(); };
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '');
export const american = (o) => o > 0 ? 100 / (o + 100) : -o / (-o + 100);
export function devig2(a, b) { const ia = american(a), ib = american(b); return [ia / (ia + ib), ib / (ia + ib)]; }

// Find the next scheduled game involving `teamQuery` (city, nickname, or "X vs Y").
export async function findGame(league, teamQuery, daysAhead = 10) {
  const path = LEAGUES[league]; if (!path) throw new Error('unknown league');
  const q = norm(teamQuery).split(/\s+/).filter(w => w && !/^(vs?|at|or|and|the|game|who|wins?|will|win|tonight|today|tomorrow)$/.test(w));
  const dates = []; for (let d = 0; d < daysAhead; d++) { const t = new Date(Date.now() + d * 864e5); dates.push(t.toISOString().slice(0, 10).replace(/-/g, '')); }
  const groups = league === 'cfb' ? '&groups=80' : '';
  for (const day of [...new Set([dates[0], dates.slice(1, 7).join(','), dates.slice(7).join(',')])].filter(Boolean)) {
    const sb = await get(`${ESPN}/${path}/scoreboard?dates=${day}${groups}&limit=200`).catch(() => ({ events: [] }));
    for (const ev of sb.events || []) {
      const names = norm(ev.name) + ' ' + (ev.competitions?.[0]?.competitors || []).map(c => norm(c.team.displayName + ' ' + c.team.abbreviation + ' ' + c.team.name + ' ' + c.team.location)).join(' ');
      if (q.every(term => names.includes(term))) return { ev, path };
    }
  }
  return null;
}
export async function gameReport(league, teamQuery) {
  const hit = await findGame(league, teamQuery); if (!hit) return { error: `No upcoming ${league.toUpperCase()} game found for "${teamQuery}" in the next 10 days.` };
  const { ev, path } = hit; const comp = ev.competitions[0];
  const sum = await get(`${ESPN}/${path}/summary?event=${ev.id}`).catch(() => ({}));
  const teams = comp.competitors.map(c => ({ name: c.team.displayName, abbr: c.team.abbreviation, homeAway: c.homeAway, record: c.records?.[0]?.summary, score: c.score }));
  const odds = (sum.pickcenter || comp.odds || [])[0];
  const ml = odds ? { provider: odds.provider?.name, spread: odds.details, overUnder: odds.overUnder, awayML: odds.awayTeamOdds?.moneyLine, homeML: odds.homeTeamOdds?.moneyLine } : null;
  let bookFair = null; if (ml?.awayML && ml?.homeML) { const [a, h] = devig2(ml.awayML, ml.homeML); bookFair = { away: Math.round(a * 100), home: Math.round(h * 100) }; }
  const pred = sum.predictor ? { source: 'ESPN FPI', away: sum.predictor.awayTeam?.gameProjection, home: sum.predictor.homeTeam?.gameProjection } : null;
  const injuries = (sum.injuries || []).map(t => ({ team: t.team?.displayName, out: (t.injuries || []).filter(i => /out|doubtful|ir/i.test(i.status)).slice(0, 8).map(i => `${i.athlete?.displayName} (${i.athlete?.position?.abbreviation || '?'}, ${i.status})`) }));
  const lastFive = (sum.lastFiveGames || []).map(t => ({ team: t.team?.displayName, games: (t.events || []).slice(0, 5).map(g => `${g.atVs}${g.opponent?.abbreviation || ''} ${g.gameResult || ''} ${g.score || ''}`.trim()) }));
  const leaders = (sum.leaders || []).map(t => ({ team: t.team?.displayName, stats: (t.leaders || []).slice(0, 3).map(l => `${l.name}: ${l.leaders?.[0]?.athlete?.displayName} ${l.leaders?.[0]?.displayValue}`) }));
  const news = (sum.news?.articles || []).slice(0, 5).map(a => a.headline);
  const weather = ev.weather ? `${ev.weather.displayValue}, ${ev.weather.temperature}°F` : null;
  // Kalshi odds for the same game
  let kalshi = null;
  try {
    const ms = await markets(KALSHI[league]);
    const want = teams.map(t => norm(t.name.split(' ').slice(0, -1).join(' ')));
    const hits = ms.filter(m => want.some(w => w && norm(m.yesSub).includes(w.split(' ')[0])) && Math.abs(new Date(m.close) - new Date(ev.date)) < 5 * 864e5);
    if (hits.length >= 2) { const mid = (m) => m.yesBid != null && m.yesAsk != null ? (m.yesBid + m.yesAsk) / 2 : m.last; const s = hits.reduce((a, m) => a + (mid(m) || 0), 0); kalshi = hits.map(m => ({ team: m.yesSub, yesAsk: m.yesAsk, winPct: s ? Math.round((mid(m) / s) * 100) : null, ticker: m.ticker })); }
  } catch {}
  return { game: ev.name, kickoff: ev.date, venue: comp.venue?.fullName, weather, teams, sportsbook: ml, sportsbookFairWinPct: bookFair, espnPredictor: pred, kalshi, injuries, lastFive, leaders, news, status: ev.status?.type?.description };
}
export async function cryptoReport(sym = 'BTC') {
  const spot = Number((await (await fetch(`https://api.coinbase.com/v2/prices/${sym}-USD/spot`)).json()).data.amount);
  const end = Date.now(); const dv = await (await fetch(`https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=${sym}&resolution=3600&start_timestamp=${end - 3 * 3600e3}&end_timestamp=${end}`)).json();
  const sigma = dv.result?.data?.slice(-1)[0]?.[4];
  const candles = await (await fetch(`https://api.exchange.coinbase.com/products/${sym}-USD/candles?granularity=86400`)).json().catch(() => []);
  const last7 = Array.isArray(candles) ? candles.slice(0, 7).map(c => ({ day: new Date(c[0] * 1000).toISOString().slice(0, 10), close: c[4], change: Math.round(((c[4] - c[3]) / c[3]) * 1000) / 10 })) : [];
  const ladder = (await markets(sym === 'BTC' ? 'KXBTCD' : 'KXETHD')).filter(m => m.yesAsk != null).sort((a, b) => (a.strike || 0) - (b.strike || 0)).map(m => `${m.yesSub} YES ${Math.round(m.yesAsk * 100)}¢ (closes ${m.close.slice(0, 16)}Z)`);
  return { sym, spot, impliedVolPct: sigma, dailyMovePct: sigma ? Math.round(sigma / Math.sqrt(365) * 10) / 10 : null, last7, kalshiLadder: ladder.slice(0, 30) };
}

// Vig-free sportsbook win % for a Kalshi game (by league, game date and the two Kalshi team codes). Used as the edge reference.
const ALIAS = { JAC: 'JAX', WAS: 'WSH', LV: 'LV', SJ: 'SJ', TB: 'TB', NO: 'NO', NE: 'NE', KC: 'KC', GB: 'GB', SF: 'SF', LAR: 'LAR', LAC: 'LAC', NYJ: 'NYJ', NYG: 'NYG' };
const sbCache = new Map();
export async function bookFair(league, date, awayCode, homeCode) {
  const path = LEAGUES[league]; if (!path) return null;
  const key = `${league}:${date}`;
  if (!sbCache.has(key)) sbCache.set(key, get(`${ESPN}/${path}/scoreboard?dates=${date.replace(/-/g, '')}${league === 'cfb' ? '&groups=80' : ''}&limit=200`).catch(() => ({ events: [] })));
  const sb = await sbCache.get(key);
  const a = (ALIAS[awayCode] || awayCode).toUpperCase(), h = (ALIAS[homeCode] || homeCode).toUpperCase();
  for (const ev of sb.events || []) {
    const comp = ev.competitions?.[0]; const abbrs = (comp?.competitors || []).map(c => c.team.abbreviation.toUpperCase());
    if (!(abbrs.includes(a) && abbrs.includes(h))) continue;
    const o = comp.odds?.[0]; if (!o?.awayTeamOdds?.moneyLine || !o?.homeTeamOdds?.moneyLine) return null;
    const [fa, fh] = devig2(o.awayTeamOdds.moneyLine, o.homeTeamOdds.moneyLine);
    const awayIsAway = comp.competitors.find(c => c.homeAway === 'away')?.team.abbreviation.toUpperCase() === a;
    return { away: awayIsAway ? fa : fh, home: awayIsAway ? fh : fa, provider: o.provider?.name, spread: o.details, status: ev.status?.type?.state, kickoff: ev.date };
  }
  return null;
}
