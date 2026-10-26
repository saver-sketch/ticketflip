// Kalshi game moneylines vs Polymarket's price for the same game (sharp-ish reference), devigged sportsbook odds when THE_ODDS_API_KEY exists.
import { markets, orderbook, bestYesAsk, bestNoAsk } from '../kalshi.js';
import { evaluate } from './kelly.js';

const LEAGUES = { KXNBAGAME: 'nba', KXNFLGAME: 'nfl', KXNHLGAME: 'nhl', KXMLBGAME: 'mlb', KXNCAAFGAME: 'cfb', KXNCAABGAME: 'cbb' };
const MONTHS = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
// KXNBAGAME-26OCT29MEMPOR → { date: 2026-10-29, away: MEM, home: POR }
function parseEvent(eventTicker, mkts = []) {
  const m = eventTicker.match(/-(\d{2})([A-Z]{3})(\d{2})([A-Z]+)$/);
  if (!m) return null;
  const codes = mkts.map(x => x.ticker.split('-').pop());
  const away = codes.find(c => m[4].startsWith(c) && codes.includes(m[4].slice(c.length)));
  if (!away) return null;
  return { date: `20${m[1]}-${MONTHS[m[2]]}-${m[3]}`, away: away.toLowerCase(), home: m[4].slice(away.length).toLowerCase() };
}
async function polyGame(league, g) {
  const tryslugs = [`${league}-${g.away}-${g.home}-${g.date}`, `${league}-${g.home}-${g.away}-${g.date}`];
  for (const slug of tryslugs) {
    const j = await (await fetch(`https://gamma-api.polymarket.com/events?slug=${slug}`)).json().catch(() => []);
    const ev = Array.isArray(j) ? j[0] : null; if (!ev) continue;
    const ml = (ev.markets || []).find(m => m.question === ev.title) || (ev.markets || [])[0];
    if (!ml) continue;
    const outcomes = JSON.parse(ml.outcomes || '[]'), prices = JSON.parse(ml.outcomePrices || '[]').map(Number);
    return { slug, title: ev.title, outcomes, prices, liquidity: ml.liquidityNum || 0, url: `https://polymarket.com/event/${slug}` };
  }
  return null;
}
// Devig a two-way moneyline (American odds) with the proportional method.
export function devig(odds) { const imp = odds.map(o => o > 0 ? 100 / (o + 100) : -o / (-o + 100)); const s = imp.reduce((a, b) => a + b, 0); return imp.map(x => x / s); }

export async function scanSports({ bankroll = 500, minEdge = 0.03, minDepth = 200, log = () => {} } = {}) {
  const out = [];
  for (const [series, league] of Object.entries(LEAGUES)) {
    let ms; try { ms = await markets(series); } catch (e) { log(`kalshi ${series}: ${e.message}`); continue; }
    const byEvent = new Map(); for (const m of ms) { if (!byEvent.has(m.event)) byEvent.set(m.event, []); byEvent.get(m.event).push(m); }
    for (const [ev, mkts] of byEvent) {
      const g = parseEvent(ev, mkts); if (!g) continue;
      const daysOut = (new Date(mkts[0].close) - Date.now()) / 864e5; if (daysOut > 8) continue;
      let poly; try { poly = await polyGame(league, g); } catch { poly = null; }
      if (!poly || poly.liquidity < 2000) continue; // need a real reference price
      // Polymarket slug order (away, home) matches the Kalshi event code order; each Kalshi market's ticker ends with its team code.
      const slugCodes = poly.slug.split('-').slice(1, 3);
      for (const m of mkts) {
        const code = m.ticker.split('-').pop().toLowerCase();
        const idx = slugCodes.indexOf(code);
        if (idx < 0 || poly.outcomes.length !== 2) continue;
        const fairYes = poly.prices[idx]; if (!(fairYes > 0.03 && fairYes < 0.97)) continue;
        let ob; try { ob = await orderbook(m.ticker, 3); } catch { continue; }
        const yes = bestYesAsk(ob), no = bestNoAsk(ob);
        for (const [side, q, ask] of [['YES', fairYes, yes], ['NO', 1 - fairYes, no]]) {
          if (!ask || ask.size * ask.price < minDepth) continue;
          const e = evaluate({ fair: q, price: ask.price, bankroll });
          if (e.edge >= minEdge) out.push({ kind: 'sports', league, market: m, side, fair: q, ask, ...e, ref: poly, basis: `Polymarket has ${poly.outcomes[idx]} at ${(fairYes * 100).toFixed(0)}¢ with $${Math.round(poly.liquidity).toLocaleString()} of liquidity`, why: `Same game, two exchanges. Polymarket's deeper book prices ${poly.outcomes[idx]} to win at ${(fairYes * 100).toFixed(0)}%. Kalshi is asking ${(ask.price * 100).toFixed(0)}¢ for ${side} on ${m.yesSub}. The gap is bigger than the fee.`, risks: ['Line moves: injuries and lineups shift both books fast; check the gap still exists when you click.', 'Polymarket can be the one that is wrong.', 'Thin Kalshi book: size may not be there at the quoted price.'] });
        }
      }
    }
  }
  return out.sort((a, b) => b.edge - a.edge);
}
