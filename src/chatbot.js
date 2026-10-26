// Always-on helper bot for #chat: answers questions about the picks, the Kalshi cards, the rules and the process.
// Trigger: @Ticketflip mention, a message starting with "?", or any message in a thread the bot started.
import { Client, GatewayIntentBits, Partials, ChannelType } from 'discord.js';
import Anthropic from '@anthropic-ai/sdk';
import { cfg } from './config.js';
import { sql } from './db.js';
import { PLAYBOOK as BASE, EXTRA } from './playbook-data.js';
const PLAYBOOK = [...BASE, ...EXTRA];

// Message Content is a privileged intent (toggle in the dev portal → Bot). Without it the bot still sees @mentions.
const withContent = process.env.NO_CONTENT_INTENT !== '1';
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, ...(withContent ? [GatewayIntentBits.MessageContent] : [])], partials: [Partials.Channel] });
const anthropic = new Anthropic();
const CHAT = process.env.DISCORD_CHAT_CHANNEL_ID;

async function context() {
  const picks = await sql`select name, venue, score, verdict, first_presale, onsale from events where verdict in ('BUY','WATCH') order by (score->>'roi')::numeric desc limit 12`.catch(() => []);
  const alerts = await sql`select ticker, side, kind, fair, price, edge, stake, at from kalshi_alerts where at > now() - interval '24 hours' order by edge desc limit 12`.catch(() => []);
  const ledger = await sql`select who, action, qty, unit_cost, sale_price, marketplace, note, at from picks where who is not null order by at desc limit 20`.catch(() => []);
  return [
    '## Current ticket picks (top by projected ROI)',
    ...picks.map(p => `- ${p.verdict} ${p.name} @ ${p.venue?.name}, ${p.venue?.city}: face $${p.score?.face}${p.score?.faceEst ? ' (est.)' : ''}, sell ~$${p.score?.sell}, net ~$${p.score?.net}/ticket, ROI ${Math.round((p.score?.roi || 0) * 100)}%, ${p.score?.label}; first presale ${p.first_presale || 'n/a'}, onsale ${p.onsale}`),
    '## Kalshi edge alerts (last 24h)',
    ...alerts.map(a => `- ${a.kind} ${a.side} ${a.ticker}: price ${Math.round(a.price * 100)}¢, fair ${Math.round(a.fair * 100)}¢, edge ${Math.round(a.edge * 100)}¢, stake $${a.stake}`),
    '## Group ledger (recent)',
    ...ledger.map(l => `- ${l.who} ${l.action} ${l.qty} × ${l.note} @ $${l.unit_cost ?? l.sale_price}${l.marketplace ? ' on ' + l.marketplace : ''} (${new Date(l.at).toISOString().slice(0, 10)})`),
  ].join('\n');
}
const SYSTEM = `You are Ticketflip, the helper bot in a small private Discord where friends flip concert tickets and trade Kalshi contracts. Answer questions plainly, like a sharp friend who knows the playbook, in 2–6 short sentences unless a step-by-step is asked for. Use Discord markdown sparingly (bold for numbers that matter). Never invent prices or picks: if the answer needs live data you don't have, say what to check and where. Hard rules you always uphold: one Ticketmaster account per person within the posted limit, nobody shares accounts or cards, never list a ticket you don't hold, Kalshi cards are alerts not orders, stocks posts are information not advice. If someone asks "should I buy X", walk them through the card's numbers and risks and let them decide; don't cheerlead.

# The playbook (what members were told)
${PLAYBOOK.map(p => `## ${p.title}\n${p.description}`).join('\n\n')}`;

client.on('messageCreate', async (msg) => {
  try {
    if (msg.author.bot) return;
    const mentioned = msg.mentions.has(client.user) || (msg.content || '').includes(`<@${client.user.id}>`);
    console.log(`msg in ${msg.channelId} from ${msg.author.username}: mentioned=${mentioned} len=${(msg.content || '').length}`);
    const inThread = msg.channel.isThread() && msg.channel.ownerId === client.user.id;
    const prefixed = /^\?\s*\S/.test(msg.content || '');
    const inChat = !CHAT || msg.channelId === CHAT || (msg.channel.isThread() && msg.channel.parentId === CHAT);
    if (!(mentioned || prefixed || inThread) || !inChat) return;
    const question = (msg.content || '').replace(/<@!?\d+>/g, '').replace(/^\?\s*/, '').trim();
    if (!question) return;
    await msg.channel.sendTyping();
    const history = await msg.channel.messages.fetch({ limit: 12 });
    const prior = [...history.values()].filter(m => m.id !== msg.id && m.content).reverse().slice(-10).map(m => ({ role: m.author.id === client.user.id ? 'assistant' : 'user', content: `${m.author.id === client.user.id ? '' : m.author.displayName + ': '}${m.content.replace(/<@!?\d+>/g, '').slice(0, 800)}` }));
    const ctx = await context();
    const r = await anthropic.messages.create({ model: 'claude-opus-5-5', max_tokens: 700, output_config: { effort: 'medium' }, system: `${SYSTEM}\n\n# Live state right now\n${ctx}`, messages: [...prior, { role: 'user', content: `${msg.author.displayName}: ${question}` }] });
    let text = r.content.filter(b => b.type === 'text').map(b => b.text).join('').trim() || "I don't have a good answer for that one.";
    if (text.length > 1900) text = text.slice(0, 1890) + '…';
    await msg.reply({ content: text, allowedMentions: { repliedUser: true } });
  } catch (e) { console.error('chat', e.message); try { await msg.reply('Something broke on my side. Ask again in a minute.'); } catch {} }
});
client.once('clientReady', () => console.log(`chatbot online as ${client.user.tag}; answering in channel ${CHAT || 'any'}`));
client.login(process.env.DISCORD_BOT_TOKEN).catch((e) => {
  if (/disallowed intents/i.test(e.message) && withContent) {
    console.log('Message Content intent is off in the dev portal → running mention-only (@Ticketflip). Flip it on to enable "?" questions.');
    process.env.NO_CONTENT_INTENT = '1';
    import('node:child_process').then(({ spawn }) => { const c = spawn(process.execPath, [new URL(import.meta.url).pathname], { stdio: 'inherit', env: process.env }); c.on('exit', (code) => process.exit(code ?? 0)); });
  } else { console.error('login failed', e.message); process.exit(1); }
});
