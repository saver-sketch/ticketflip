// Playbook content shared by the poster scripts and the chat bot.
export const PLAYBOOK = [
  { title: '👋 Start here', color: 0x5865f2, description: [
    'Bots find the plays. You make the move. That\'s it.',
    '',
    '**#presales** — concert tickets to flip. Card says buy how many, when, the link, where to sell, expected profit.',
    '**#alerts** — a ping 24h and 15 min before a presale we want.',
    '**#kalshi-sports** — every football game with win odds + plays when Kalshi\'s price is off.',
    '**#kalshi-crypto** — Bitcoin/Ethereum plays.',
    '**#stocks** — options ideas: the trade, entry, target, stop, out-by date.',
    '**#buys / #sold** — post what you bought or sold. Boards update themselves.',
    '**#chat** — ask **@Ticketflip** anything. Short answers by default; say "explain" for the long version.',
  ].join('\n') },
  { title: '🚦 Three rules', color: 0xed4245, description: [
    '1. **One Ticketmaster account each**, your name, your card, within the ticket limit. No sharing, no second accounts. (That\'s the federal-lawsuit part.)',
    '2. **Never list a ticket you don\'t have yet.**',
    '3. **Size small.** Nobody here assumes your budget. Every play is sized as a % of whatever *you* put in: 1–2% per idea, lotto options half that. Tickets: up to the limit only if you can float the cash for 6 weeks.',
  ].join('\n') },
  { title: '🎟️ Tickets in 60 seconds', color: 0x57f287, description: [
    '**Setup once:** Ticketmaster account with bank + SSN under Sell Tickets · StubHub + TickPick seller accounts · free Live Nation account · link a Citi or Amex card if you have one.',
    '**When a card drops:** be on the link 5 min early → enter the code the card tells you about → buy the cheapest tier, the number it says → post `bought 4 Act City date @ $62` in #buys.',
    '**Selling:** list on the marketplace the card names within 48h at its price. When it sells, transfer from the Ticketmaster app → My Events → Transfer → buyer\'s email, before the deadline. Post `sold 2 Act City @ $140 StubHub` in #sold.',
    '**Money math:** face $45 → you pay ~$56 → sell $118 → ~$44 profit each after fees. Payout lands 1–2 weeks **after the show**.',
  ].join('\n') },
  { title: '📊 Kalshi in 30 seconds', color: 0x5865f2, description: [
    'Contracts pay $1 if YES, $0 if not. Price = the market\'s odds. We post when our number beats the price by 3¢+ after fees.',
    '**Card says:** buy YES/NO at X¢, how many, the ticker. Kalshi app → search ticker → limit order at that price or better. If it moved past, skip.',
    'Expect to lose plenty individually. The edge shows up over 50+ plays.',
  ].join('\n') },
  { title: '📈 Options in 30 seconds', color: 0x5865f2, description: [
    'Weekday mornings: 2–3 ideas. Each has the exact contract, **entry**, **target**, **stop**, **out-by date**. Midday + close: hold / take profit / cut. Scoreboard tracks every idea.',
    '🟢 spread (max loss = what you paid) · 🟡 earnings vol play · 🔴 lotto (most expire worthless; the hit pays big).',
    '**Exits aren\'t optional.** Target → sell. Stop → sell. Date → sell.',
  ].join('\n') },
  { title: '🤖 Ask the bot', color: 0x57f287, description: [
    'In #chat: `? who wins cowboys or eagles` · `? how much on the Bitcoin play` · `@Ticketflip is the NVDA spread still good`',
    'It answers short. Say **"explain"** or **"why"** and it gives you the full breakdown.',
  ].join('\n') },
];

export const EXTRA = [];
