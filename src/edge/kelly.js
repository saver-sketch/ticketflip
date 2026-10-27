// Edge after fees + quarter-Kelly stake for a binary contract bought at price p with fair probability q.
import { fee } from '../kalshi.js';
export function evaluate({ fair, price, kellyFraction = 0.25 }) {
  const f = fee(price);
  const cost = price + f;                       // per contract, all-in
  const edge = fair - cost;                     // expected profit per contract (payout 1)
  const edgePct = cost ? edge / cost : 0;
  const b = (1 - cost) / cost;                  // net odds
  const kelly = b > 0 ? (fair * b - (1 - fair)) / b : 0;
  const stakePct = Math.max(0, Math.min(0.1, kelly * kellyFraction)); // fraction of whatever the person trades with
  return { fee: f, cost: r(cost), edge: r(edge), edgePct: r(edgePct), kelly: r(kelly), stakePct: r(stakePct) };
}
const r = (x) => Math.round(x * 1000) / 1000;
