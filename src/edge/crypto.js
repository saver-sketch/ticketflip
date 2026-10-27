// Kalshi BTC/ETH price contracts vs a volatility-based fair probability.
// Fair P(index > strike at T) from spot S, annualized implied vol σ (Deribit DVOL), time τ: lognormal with zero drift.
import { markets, orderbook, bestYesAsk, bestNoAsk } from '../kalshi.js';
import { evaluate } from './kelly.js';

// His call 10/27: Bitcoin 15-minute contracts ONLY.
const SERIES = { BTC: ['KXBTC15M'] };
async function spot(sym) { const j = await (await fetch(`https://api.coinbase.com/v2/prices/${sym}-USD/spot`)).json(); return Number(j.data.amount); }
async function dvol(sym) {
  const end = Date.now(), start = end - 3 * 3600e3;
  const j = await (await fetch(`https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=${sym}&resolution=3600&start_timestamp=${start}&end_timestamp=${end}`)).json();
  const rows = j.result?.data || []; return rows.length ? rows[rows.length - 1][4] / 100 : null; // close value, as a fraction
}
const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
export function probAbove(S, K, sigma, tauYears) { if (tauYears <= 0) return S > K ? 1 : 0; const d = (Math.log(K / S) + 0.5 * sigma * sigma * tauYears) / (sigma * Math.sqrt(tauYears)); return 1 - Phi(d); }

export async function scanCrypto({ minEdge = 0.03, minDepth = 200, log = () => {} } = {}) {
  const out = [];
  for (const [sym, series] of Object.entries(SERIES)) {
    let S, sigma; try { S = await spot(sym); sigma = await dvol(sym); } catch (e) { log(`crypto ${sym} data: ${e.message}`); continue; }
    if (!S || !sigma) continue;
    for (const s of series) {
      let ms; try { ms = await markets(s); } catch (e) { log(`kalshi ${s}: ${e.message}`); continue; }
      for (const m of ms) {
        if (!m.close || (m.floor == null && m.cap == null)) continue;
        const tau = (new Date(m.close) - Date.now()) / (365.25 * 864e5);
        const minsLeft = tau * 365.25 * 24 * 60;
        if (minsLeft < 3 || minsLeft > 16) continue; // only the live 15-minute window, with time to act
        let fairYes;
        if (/between/.test(m.strikeType) && m.floor != null && m.cap != null) fairYes = probAbove(S, m.floor, sigma, tau) - probAbove(S, m.cap, sigma, tau);
        else if (/less|below/.test(m.strikeType)) fairYes = 1 - probAbove(S, m.cap ?? m.floor, sigma, tau);
        else fairYes = probAbove(S, m.floor ?? m.cap, sigma, tau);
        if (fairYes < 0.08 || fairYes > 0.92) continue; // tails: the lognormal model is least trustworthy there
        let ob; try { ob = await orderbook(m.ticker, 3); } catch { continue; }
        const yes = bestYesAsk(ob), no = bestNoAsk(ob);
        for (const [side, q, ask] of [['YES', fairYes, yes], ['NO', 1 - fairYes, no]]) {
          if (!ask || ask.size * ask.price < minDepth) continue;
          const ev = evaluate({ fair: q, price: ask.price });
          if (ev.edge >= minEdge) out.push({ kind: 'crypto', sym, market: m, side, fair: q, ask, ...ev, basis: `spot $${Math.round(S).toLocaleString()} vs line $${Math.round(m.strike).toLocaleString()} · vol ${(sigma * 100).toFixed(0)}% · ${minsLeft.toFixed(0)} min left`, why: `BTC is at $${Math.round(S).toLocaleString()}, the line is $${Math.round(m.strike).toLocaleString()}, ${minsLeft.toFixed(0)} min left → ${(fairYes * 100).toFixed(0)}% it finishes above. Kalshi wants ${(ask.price * 100).toFixed(0)}¢ for ${side}.`, risks: ['Vol-model math: a news shock moves the index more than the model expects.', 'Kalshi settles on the CF Benchmarks index average over the final minute, not the Coinbase print.', 'Thin books: your fill can be worse than the quoted ask.'] });
        }
      }
    }
  }
  return out.sort((a, b) => b.edge - a.edge);
}
