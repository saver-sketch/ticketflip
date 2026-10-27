// The analyst: answers a member's question with real research (Kalshi odds, ESPN report, sportsbook line, web news) and reasons.
import Anthropic from '@anthropic-ai/sdk';
import { gameReport, cryptoReport } from './research.js';
import { footballLines } from './edge/lines.js';

const anthropic = new Anthropic();
const TOOLS = [
  { name: 'game_report', description: 'Full pre-game report for an upcoming game: both teams, records, last five results, injuries (out/doubtful), DraftKings spread/total/moneylines with the vig-free win %, ESPN FPI win %, Kalshi win % and YES prices, weather, venue, recent headlines. Call this for ANY question about who wins / odds / should I bet a specific game.', input_schema: { type: 'object', properties: { league: { type: 'string', enum: ['nfl', 'cfb', 'nba', 'nhl', 'mlb'] }, teams: { type: 'string', description: 'team names as the user wrote them, e.g. "cowboys eagles"' } }, required: ['league', 'teams'], additionalProperties: false }, strict: true },
  { name: 'football_board', description: 'Every NFL and college game on Kalshi in the next 8 days with both sides win %. Use for "what games are this week" or slate-wide questions.', input_schema: { type: 'object', properties: {}, additionalProperties: false }, strict: true },
  { name: 'crypto_report', description: 'Bitcoin or Ethereum: spot price, implied volatility, expected daily move, last 7 daily closes, and the Kalshi price ladder with YES asks. Use for any BTC/ETH question.', input_schema: { type: 'object', properties: { sym: { type: 'string', enum: ['BTC', 'ETH'] } }, required: ['sym'], additionalProperties: false }, strict: true },
  { name: 'open_ideas', description: 'The options desk\'s ideas (open and recently closed): ticker, structure, legs, entry, target, stop, exit date, catalyst, thesis, status, result. Use for any question about an options idea posted in #stocks.', input_schema: { type: 'object', properties: {}, additionalProperties: false }, strict: true },
  { type: 'web_search_20260209', name: 'web_search', max_uses: 2 },
];
async function runTool(name, input) {
  try {
    if (name === 'game_report') return JSON.stringify(await gameReport(input.league, input.teams));
    if (name === 'football_board') return JSON.stringify((await footballLines()).map(r => `${r.league} ${r.date} ${r.awayName} ${Math.round(r.kalshiA * 100)}% @ ${r.homeName} ${Math.round(r.kalshiH * 100)}%`));
    if (name === 'crypto_report') return JSON.stringify(await cryptoReport(input.sym));
    if (name === 'open_ideas') { const { execFile } = await import('node:child_process'); return await new Promise((res) => execFile(process.execPath, ['scripts/idea.mjs', 'json'], { env: process.env, cwd: new URL('..', import.meta.url).pathname }, (e, out) => res(e ? JSON.stringify({ error: e.message }) : out.trim() || '[]'))); }
  } catch (e) { return JSON.stringify({ error: e.message }); }
  return JSON.stringify({ error: 'unknown tool' });
}

export const ANALYST_SYSTEM = `You are Ticketflip, the bot in a small private Discord where friends trade Kalshi contracts, flip concert tickets, and trade options. Talk like a sharp friend texting: casual, short, direct. Default to the MINIMUM: tell them what to do, where, when, and one line of why. Only go deep when they ask ("why", "explain", "tell me more", "breakdown").

Default shapes (keep these tight):
- Game question ("who wins X or Y", "odds"): call game_report first. Reply in 3–4 lines:
  **Kalshi:** Team A 67% · Team B 33%
  **Me:** Team A 70%. <one-line reason>
  **Play:** "YES Team A at 61¢ on Kalshi (ticker)" or "nothing here, price is fair". 
  If they ask how much: "<edge-based stake>, or $5–10 if you just want action."
- Ticket question: what to buy, link, when, where to sell, expected profit. 2–4 lines.
- Crypto: call crypto_report. "YES/NO at X¢ looks good because <one line>" or "pass".
- Options idea question: call open_ideas. "<idea> is at $X vs $Y entry → hold/take profit/cut."
- Anything else: 1–3 sentences.

When they ask for the long version, give the full breakdown: injuries, form, line vs fair, risks, what flips it.

Rules you keep quietly: one Ticketmaster account per person within limits; Kalshi cards are alerts, not orders; options ideas are ideas, not advice (one short line max, only if they ask you to decide for them). Never mention Polymarket by name. Never invent prices; if you don't have a number, say so and say where it'd come from. Channel names: #presales, #alerts, #kalshi-sports, #kalshi-crypto, #stocks, #buys, #sold, #chat, #start-here.

SHORT preview shape (for game previews): line 1 "**A @ B** · Kalshi A x% / B y%", line 2 "**Me:** A z% — <reason>", line 3 "**Play:** <side at price on Kalshi, or 'pass'>", line 4 "**Flip it:** <one thing>".`;

export async function analyze({ question, history = [], extraSystem = '', log = () => {} }) {
  const messages = [...history, { role: 'user', content: question }];
  for (let i = 0; i < 6; i++) {
    const r = await anthropic.messages.create({ model: process.env.ANALYST_MODEL || 'claude-sonnet-5-5', max_tokens: 700, output_config: { effort: 'medium' }, system: `${ANALYST_SYSTEM}\n\n${extraSystem}`, tools: TOOLS, messages });
    if (r.stop_reason === 'refusal') return 'I can\'t help with that one.';
    const toolUses = r.content.filter(b => b.type === 'tool_use');
    messages.push({ role: 'assistant', content: r.content });
    if (!toolUses.length || r.stop_reason !== 'tool_use') return r.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    const results = [];
    for (const t of toolUses) { log(`tool ${t.name} ${JSON.stringify(t.input)}`); results.push({ type: 'tool_result', tool_use_id: t.id, content: await runTool(t.name, t.input) }); }
    messages.push({ role: 'user', content: results });
  }
  return 'That took too many steps; ask me more specifically.';
}

if (process.argv[1] && /analyst\.js$/.test(process.argv[1])) { console.log(await analyze({ question: process.argv.slice(2).join(' ') || 'who is going to win cowboys or eagles?', log: console.log })); }
