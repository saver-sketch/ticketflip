// All runtime config from env. Copy .env.example → .env locally; Render env in prod.
import fs from 'node:fs';
if (fs.existsSync(new URL('../.env', import.meta.url))) {
  for (const line of fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}
const need = (k) => { if (!process.env[k]) throw new Error(`missing env ${k}`); return process.env[k]; };
export const cfg = {
  tmKey: () => need('TM_API_KEY'),
  sgClientId: () => process.env.SEATGEEK_CLIENT_ID || '',
  dbUrl: () => need('DATABASE_URL'),
  discordWebhook: () => process.env.DISCORD_WEBHOOK_URL || '',
  alertsWebhook: () => process.env.DISCORD_ALERTS_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || '',
  startWebhook: () => process.env.DISCORD_START_WEBHOOK_URL || '',
  // Scan window: presales/onsales starting within this many days.
  horizonDays: Number(process.env.HORIZON_DAYS || 14),
  // Verdict thresholds on projected ROI (net profit / cash out).
  buyRoi: Number(process.env.BUY_ROI || 0.40),
  watchRoi: Number(process.env.WATCH_ROI || 0.15),
  // Fees: marketplace seller cut and Ticketmaster buyer fees on top of face.
  sellerFee: Number(process.env.SELLER_FEE || 0.15),
  buyerFee: Number(process.env.BUYER_FEE || 0.25),
  bankroll: Number(process.env.BANKROLL || 1500),
  tz: 'America/Los_Angeles',
  digestHourLocal: Number(process.env.DIGEST_HOUR || 8),
};
