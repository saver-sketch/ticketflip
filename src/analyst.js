// The analyst: answers a member's question with real research (Kalshi odds, ESPN report, sportsbook line, web news) and reasons.
import Anthropic from '@anthropic-ai/sdk';
import { gameReport, cryptoReport } from './research.js';
import { footballLines } from './edge/lines.js';

const anthropic = new Anthropic();
const TOOLS = [
  { name: 'game_report', description: 'Full pre-game report for an upcoming game: both teams, records, last five results, injuries (out/doubtful), DraftKings spread/total/moneylines with the vig-free win %, ESPN FPI win %, Kalshi win % and YES prices, weather, venue, recent headlines. Call this for ANY question about who wins / odds / should I bet a specific game.', input_schema: { type: 'object', properties: { league: { type: 'string', enum: ['nfl', 'cfb', 'nba', 'nhl', 'mlb'] }, teams: { type: 'string', description: 'team names as the user wrote them, e.g. "cowboys eagles"' } }, required: ['league', 'teams'], additionalProperties: false }, strict: true },
  { name: 'football_board', description: 'Every NFL and college game on Kalshi in the next 8 days with both sides win %. Use for "what games are this week" or slate-wide questions.', input_schema: { type: 'object', properties: {}, additionalProperties: false }, strict: true },
  { name: 'crypto_report', description: 'Bitcoin or Ethereum: spot price, implied volatility, expected daily move, last 7 daily closes, and the Kalshi price ladder with YES asks. Use for any BTC/ETH question.', input_schema: { type: 'object', properties: { sym: { type: 'string', enum: ['BTC', 'ETH'] } }, required: ['sym'], additionalProperties: false }, strict: true },
  { type: 'web_search_20260209', name: 'web_search', max_uses: 3 },
];
async function runTool(name, input) {
  try {
    if (name === 'game_report') return JSON.stringify(await gameReport(input.league, input.teams));
    if (name === 'football_board') return JSON.stringify((await footballLines()).map(r => `${r.league} ${r.date} ${r.awayName} ${Math.round(r.kalshiA * 100)}% @ ${r.homeName} ${Math.round(r.kalshiH * 100)}%`));
    if (name === 'crypto_report') return JSON.stringify(await cryptoReport(input.sym));
  } catch (e) { return JSON.stringify({ error: e.message }); }
  return JSON.stringify({ error: 'unknown tool' });
}

export const ANALYST_SYSTEM = `You are Ticketflip, the analyst bot in a small private Discord where friends trade Kalshi contracts and flip concert tickets. You give educated, reasoned calls, not hedges.

For "who wins X or Y" / "odds on X" / "should I take X": ALWAYS call game_report first (and web_search once if injuries or news could have changed in the last day). Then answer in this shape, in Discord markdown, under ~220 words:
**Kalshi:** Team A 67% · Team B 33%  (the market's number, with YES prices)
**My call:** Team A 70% · Team B 30%  (your own number: start from the vig-free sportsbook % and ESPN FPI, then adjust a few points for what the report shows; say which way and why)
**Why** — 3 to 5 tight bullets: injuries that matter (position + impact), form (last five), matchup/pace/QB, home field/rest/weather, line movement or news.
**Edge?** — compare your % to Kalshi's YES ask on the side you like: "YES on Dallas at 68¢ vs my 70% → ~0¢ after the 2¢ fee, no edge" or "YES at 61¢ vs my 68% → ~5¢ edge, worth a small position (quarter-Kelly ≈ $X on a $500 bankroll)". Give the ticker.
**What flips it** — one line.

Be concrete and opinionated; markets are efficient so your number will usually be within ~5 points of the book, and that's fine: the value is the reasoning and spotting when Kalshi drifts from the book. Never invent stats; if the report lacks something, say so. For crypto questions call crypto_report and reason from spot, implied vol, and the ladder. For ticket questions use the playbook you were given. Never mention Polymarket. Rules: one Ticketmaster account per person within limits; Kalshi cards are alerts, not orders; no financial advice disclaimers beyond one short line if someone asks you to decide for them.`;

export async function analyze({ question, history = [], extraSystem = '', log = () => {} }) {
  const messages = [...history, { role: 'user', content: question }];
  for (let i = 0; i < 6; i++) {
    const r = await anthropic.messages.create({ model: 'claude-opus-5-5', max_tokens: 1500, output_config: { effort: 'high' }, system: `${ANALYST_SYSTEM}\n\n${extraSystem}`, tools: TOOLS, messages });
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
