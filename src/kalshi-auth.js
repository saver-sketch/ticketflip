// Signed Kalshi requests (his account): KALSHI-ACCESS-KEY / TIMESTAMP / SIGNATURE over `${ts}${METHOD}${path}`.
import crypto from 'node:crypto';
const BASE = 'https://api.elections.kalshi.com';
function key() { const pem = process.env.KALSHI_PRIVATE_KEY || (process.env.KALSHI_PRIVATE_KEY_B64 ? Buffer.from(process.env.KALSHI_PRIVATE_KEY_B64, 'base64').toString() : null); if (!pem) throw new Error('no KALSHI_PRIVATE_KEY'); return crypto.createPrivateKey(pem); }
function sign(ts, method, path) {
  const k = key(); const data = Buffer.from(`${ts}${method}${path}`);
  if (k.asymmetricKeyType === 'ed25519') return crypto.sign(null, data, k).toString('base64');
  return crypto.sign('sha256', data, { key: k, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST }).toString('base64');
}
export async function kalshiAuthed(method, path, body) {
  const ts = String(Date.now()); const p = '/trade-api/v2' + path;
  const r = await fetch(BASE + p, { method, headers: { 'KALSHI-ACCESS-KEY': process.env.KALSHI_KEY_ID, 'KALSHI-ACCESS-TIMESTAMP': ts, 'KALSHI-ACCESS-SIGNATURE': sign(ts, method, p.split('?')[0]), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`kalshi ${r.status} ${path}: ${JSON.stringify(j).slice(0, 160)}`); return j;
}
export const balance = () => kalshiAuthed('GET', '/portfolio/balance');
export const positions = () => kalshiAuthed('GET', '/portfolio/positions?limit=200');
export const fills = (limit = 50) => kalshiAuthed('GET', `/portfolio/fills?limit=${limit}`);
export const settlements = (limit = 50) => kalshiAuthed('GET', `/portfolio/settlements?limit=${limit}`);
