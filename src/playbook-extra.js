// Kalshi + stocks sections for #start-here. `node src/playbook-extra.js` posts them.
import { cfg } from './config.js';
import { post } from './discord.js';
const EXTRA = [
  { title: '📊 #kalshi: how the edge alerts work', color: 0x5865f2, description: [
    'Kalshi contracts pay **$1 if YES happens, $0 if not**, and trade between 1¢ and 99¢. The price *is* the market\'s probability. We make money when **our** probability is higher than the price we pay, after Kalshi\'s fee.',
    '',
    '**Where our number comes from**',
    '• **Sports**: the same game is traded on Polymarket with a much deeper book. If Polymarket says a team wins 60% and Kalshi sells YES at 54¢, that gap is the edge. We only alert when the gap beats the fee by 3¢ or more.',
    '• **Crypto**: Bitcoin/Ethereum "above $X at 5 PM" contracts. We take the live price plus the options market\'s implied volatility (how much movement traders are paying for) and compute the real odds of finishing above the line. Kalshi\'s crowd is often 5–15¢ off on these.',
    '',
    '**Reading a card**: *Buy YES at 42¢, fair 51¢, edge 7¢ after fees.* Stake is **quarter-Kelly**: a fraction of the bankroll sized to the edge, capped at 10%. Small on purpose. You\'ll lose plenty of these individually; the edge shows up over 50+ contracts.',
    '**Placing it**: Kalshi app → search the ticker on the card → limit order at the card\'s price *or better*. If the price already moved past it, skip. Never market-order.',
    '**Rule**: alerts, not orders. Nobody is trading your account. Kalshi is legal in all 50 states (CFTC-regulated); you need to be 18+ with ID verified.',
  ].join('\n') },
  { title: '📈 #stocks: what it is and isn\'t', color: 0x99aab5, description: [
    'A morning brief on the Robinhood account: positions, day and total P&L, earnings coming this week for anything held, movers over 5% with the reason, and risk flags (one position over 25% of the account, a 10% drawdown).',
    'Price alerts you set yourself: type `watch NVDA below 110` in the channel.',
    'An "ideas" list from a rules screener, labeled as ideas. **Nothing in #stocks is a buy or sell call.** Nobody has an edge picking stocks from a Discord, including this bot. The useful part is the discipline: knowing what you hold, what\'s about to move it, and when you\'re over-concentrated.',
  ].join('\n') },
];
const url = cfg.startWebhook(); if (!url) { console.log('no start webhook'); process.exit(1); }
await post({ url, embeds: EXTRA }); console.log('posted', EXTRA.length);
