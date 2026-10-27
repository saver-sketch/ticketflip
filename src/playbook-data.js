// Playbook content shared by the poster scripts and the chat bot.
export const PLAYBOOK = [
  { title: '📖 Start here: what Ticketflip is', color: 0x5865f2, description: [
    'A bot watches every Ticketmaster presale and onsale in the US, scores each one for resale profit, and posts the best ones here. **You buy the tickets on your own Ticketmaster account, then resell them on StubHub or TickPick for more than you paid.** That gap is the profit.',
    '',
    '**Channels**',
    '• **#presales** — the daily top-5 at 8 AM PT, plus any new BUY the moment it appears.',
    '• **#alerts** — a ping 24 hours and 15 minutes before a presale we want. Nothing else.',
    '• **#buys** — post what you bought: `bought 4 Interpol Philly 2/3 @ $62`',
    '• **#sold** — post what you sold: `sold 2 Interpol Philly @ $140 StubHub`',
    '• **#chat** — everything else.',
  ].join('\n') },
  { title: '📏 The three rules (not optional)', color: 0xed4245, description: [
    '**1. One Ticketmaster account per person, your real name, your own card.** Ticketmaster now ties resale to your taxpayer ID. Second accounts, shared cards, VPNs and "buying for a friend" are exactly what the FTC is suing people for under the BOTS Act. A California law (AB 1349, in force Jan 1 2027) says the same thing.',
    '**2. Buy within the posted ticket limit.** Usually 4–8 per event. Every card shows it.',
    '**3. Never list a ticket you don\'t have yet.** "Speculative listing" is illegal in California. Buy first, list after the tickets are in your account.',
    '',
    'Everything the bot does (finding, scoring, timing, where to sell) is legal. The click to buy is yours.',
  ].join('\n') },
  { title: '💵 How the money works (worked example)', color: 0x57f287, description: [
    'Face price **$45**. Ticketmaster adds ~25% in fees → you pay about **$56**.',
    'Comparable dates are reselling with the cheapest quarter of listings at **$135** (3× face). You list at $118 to undercut.',
    'StubHub takes ~15% → you get **$100**. Profit **$44 per ticket**. Buy 4 → **$176** on **$225** tied up for 3–6 weeks.',
    '',
    'Realistic batting average once you follow the cards: good picks make 30–80% over face, sold-out small rooms 100–200%, a miss breaks even or loses a little. The goal is a strong average across many events, not perfection.',
    'Rule of thumb: a pick only makes money if it resells for **at least 1.5× face**. Below that the fees eat it.',
  ].join('\n') },
  { title: '🔍 Reading a card', color: 0xfee75c, description: [
    '**🎯 BUY** — the face price is published **and** comparable dates are already reselling above it. The only kind of pick we call a buy.',
    '**👀 WATCH** — good setup but the price isn\'t out, or nobody\'s reselling comparable dates yet. The card says "BUY if the cheapest tier is $X or less". When the price drops, the bot re-scores it and #alerts pings you.',
    '**🟢 Strong / 🟡 Some evidence** — how much *real* data is behind the number, not how good the deal is. Strong = published price + live resale listings. Some = venue size + fanbase only. Guesses never get posted.',
    '**ROI** — profit ÷ cash out, per ticket, after all fees.',
    '**"Comparable dates resell at 2.8× face"** — the cheapest quarter of real listings for this act\'s other shows, divided by face. That\'s the strongest signal we have.',
  ].join('\n') },
  { title: '🛒 Step by step: buying', color: 0x5865f2, description: [
    '1. Read the card\'s **How to buy** section. It names the presale, the exact time in *your* timezone, the link, and where the code comes from.',
    '2. **Codes**: Citi → link your card at citientertainment.com or type the first 6 digits of your Citi card. Amex → no code, just pay with an Amex. Live Nation → sign in with a Live Nation account (codes often posted on their socials the morning of). Artist presale → the code arrives from the artist\'s mailing list, so sign up when the card drops. Verified Fan → register at the link before the deadline, code comes by text.',
    '3. Be on the page **5 minutes early**, logged in, card saved. At the minute, refresh once, enter the code, pick the **cheapest price tier** (GA floor or the lowest-priced section). Skip VIP, Platinum, "Official Platinum" — no margin.',
    '4. Buy the quantity on the card, never more than the limit. Screenshot the order.',
    '5. Post it in #buys: `bought 4 Interpol Philly 2/3 @ $62`',
  ].join('\n') },
  { title: '🏷️ Step by step: selling', color: 0x5865f2, description: [
    '**Where** (the card ranks them for each pick):',
    '• **StubHub** (stubhub.com/sell) — biggest buyer pool. Seller fee ~10–15%. Paid 5–8 business days after the event.',
    '• **TickPick** (tickpick.com/sell-tickets) — no buyer fees, so your listing looks cheapest. Seller fee ~10–15%. Paid up to 14 days after the event.',
    '• **Ticketmaster resale** — only for Ticketmaster events; use it when the tickets can\'t be transferred. Fee ~15%, paid ~7 days after the event, needs your SSN on file.',
    '• **Gametime** — last-minute mobile buyers in the final 48 hours.',
    '',
    '**How**: list within 48 hours of buying (the card gives the price). Pick "mobile transfer" as delivery. When it sells, the marketplace emails the buyer\'s name/email → open the Ticketmaster app → My Events → Transfer → send to that email **within the deadline** (StubHub charges you the full ticket value if you miss it).',
    '**Pricing**: start at the card\'s list price. Two weeks out, drop to the mid price. Last 10 days, go to the floor. Never hold past show day. A ticket you still own at showtime is worth $0.',
    'Post it in #sold: `sold 2 Interpol Philly @ $140 StubHub`',
  ].join('\n') },
  { title: '🧾 Taxes, payouts, bankroll', color: 0x99aab5, description: [
    '• Profit is taxable income. Marketplaces send a 1099-K only above $20,000 / 200 sales a year, but you owe tax on the profit regardless. Keep the #buys and #sold posts honest; they are your records.',
    '• Payouts land 1–2 weeks after the **event**, not the sale. Money is tied up for the whole window. Only use cash you can leave alone for 6 weeks.',
    '• Start with $500–$1,500. 3–4 events a month. Expect $300–$700 a month at first, $1,000–$2,500 once you\'ve got a rhythm. Big months come from playoffs and small-room sellouts.',
    '• A refund is never coming. If a show cancels you get face back from Ticketmaster; if it doesn\'t sell, that\'s the loss. Size positions so one miss doesn\'t hurt.',
  ].join('\n') },
  { title: '❓ FAQ', color: 0x99aab5, description: [
    '**Why so few BUYs?** Ticketmaster publishes the price for only ~15% of shows before the presale. Until the price is out, the best we can say is "BUY if ≤ $X". That\'s what WATCH means.',
    '**Can I buy a WATCH pick?** Yes, if the price on the page is at or under the card\'s threshold. That\'s literally the instruction.',
    '**What about Face Value Exchange tours (Noah Kahan, Tame Impala, Jungle…)?** Skipped automatically. Those tickets can\'t be transferred and can only be resold at face. No margin.',
    '**Sports?** Playoff and rivalry games only. Regular season resells below face and the bot filters it out.',
    '**Can we share one account to get more tickets?** No. See the rules. It\'s the one thing that turns this from a side hustle into a lawsuit.',
    '**Who do I ask?** Post in #chat. Saver runs the bot.',
  ].join('\n') },
];


export const EXTRA = [
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
  { title: '🎯 #stocks: the options desk', color: 0x5865f2, description: [
    'Weekday mornings the desk posts 2–3 options ideas, each researched: the thesis and the evidence, the exact contract with a **limit entry price**, max loss, breakeven, **take-profit**, **stop**, and a **hard exit date**. Sunday night: the week ahead. Midday and close: updates on open ideas and a running scoreboard.',
    '',
    '**Tags**: 🟢 defined-risk spread (you can only lose the debit) · 🟡 earnings vol play (we bet on the *size* of the move vs what\'s priced in) · 🔴 lotto (cheap single-leg; expect most to expire worthless, the rare hit pays 3–10×).',
    '**The one rule**: risk no more than 1–2% of whatever you trade with on any idea (🔴: half that). Options can go to zero. The desk is judged on its scoreboard over months, not on one trade.',
    '**Exits are not optional**: take profit at the target, cut at the stop, and be out by the exit date even if it feels early. Holding losers through the date is how options accounts die.',
    '**Nothing here is about anyone\'s account.** Ask @Ticketflip in #chat about any idea and it will explain the thesis and where it stands.',
  ].join('\n') },
  { title: '🤖 Ask the bot anything', color: 0x57f287, description: [
    'Confused by a card, a number, or a step? Ask in **#chat**: start your message with `?` or tag **@Ticketflip**.',
    'It knows this playbook, today\'s picks, the Kalshi cards and the group ledger, and it answers like a friend who\'s done this before. Examples:',
    '• `? what does quarter-Kelly mean on the Bitcoin card`',
    '• `? how do I transfer a Ticketmaster ticket to a StubHub buyer`',
    '• `@Ticketflip is the Interpol pick still a buy if the cheapest tier is $65?`',
    'It won\'t place trades or buy tickets, and it will tell you when it doesn\'t know.',
  ].join('\n') },
];

