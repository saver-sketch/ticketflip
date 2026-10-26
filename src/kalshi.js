// Kalshi public market data (no key needed for prices). Dollar-string fields → numbers.
const BASE = 'https://api.elections.kalshi.com/trade-api/v2';
async function get(path) { const r = await fetch(BASE + path, { headers: { accept: 'application/json' } }); if (!r.ok) throw new Error(`kalshi ${r.status} ${path}`); return r.json(); }
const n = (x) => (x == null || x === '' ? null : Number(x));

export function norm(m) {
  return {
    ticker: m.ticker, event: m.event_ticker, title: m.title, yesSub: m.yes_sub_title, noSub: m.no_sub_title,
    yesBid: n(m.yes_bid_dollars), yesAsk: n(m.yes_ask_dollars), noBid: n(m.no_bid_dollars), noAsk: n(m.no_ask_dollars), last: n(m.last_price_dollars),
    yesBidSize: n(m.yes_bid_size_fp), yesAskSize: n(m.yes_ask_size_fp), volume: n(m.volume_fp), oi: n(m.open_interest_fp),
    close: m.close_time, expiration: m.expiration_time, strike: n(m.floor_strike ?? m.cap_strike), floor: n(m.floor_strike), cap: n(m.cap_strike), strikeType: m.strike_type, rules: m.rules_primary || '',
    url: `https://kalshi.com/markets/${(m.event_ticker || m.ticker).split('-')[0].toLowerCase()}/${m.event_ticker || m.ticker}`.replace(/\/[^/]*$/, `/${(m.event_ticker || m.ticker).toLowerCase()}`),
  };
}
export async function markets(series, { status = 'open', limit = 200 } = {}) {
  const out = []; let cursor = '';
  do { const j = await get(`/markets?series_ticker=${series}&status=${status}&limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`); out.push(...(j.markets || []).map(norm)); cursor = j.cursor || ''; } while (cursor && out.length < 1000);
  return out;
}
export async function orderbook(ticker, depth = 5) {
  const j = await get(`/markets/${ticker}/orderbook?depth=${depth}`);
  const ob = j.orderbook_fp || {};
  const side = (arr) => (arr || []).map(([p, s]) => ({ price: Number(p), size: Number(s) })).sort((a, b) => b.price - a.price);
  return { yesBids: side(ob.yes_dollars), noBids: side(ob.no_dollars) }; // bids only; ask YES = 1 − best NO bid
}
// Kalshi taker fee per contract: ceil(0.07 × P × (1−P)) to the cent (series multiplier assumed 1).
export const fee = (p) => Math.ceil(0.07 * p * (1 - p) * 100) / 100;
// What it costs to buy YES now (best ask) and the depth at that price, from the book.
export function bestYesAsk(ob) { const b = ob.noBids[0]; return b ? { price: Math.round((1 - b.price) * 100) / 100, size: b.size } : null; }
export function bestNoAsk(ob) { const b = ob.yesBids[0]; return b ? { price: Math.round((1 - b.price) * 100) / 100, size: b.size } : null; }
