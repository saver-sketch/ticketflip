// The #start-here playbook. Posted as a series of embeds; re-run `node src/playbook.js` to repost after edits.
import { cfg } from './config.js';
import { post } from './discord.js';

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

const url = cfg.startWebhook();
if (!url) { console.log('no DISCORD_START_WEBHOOK_URL'); process.exit(1); }
await post({ url, content: '', embeds: PLAYBOOK });
console.log('playbook posted:', PLAYBOOK.length, 'sections');
