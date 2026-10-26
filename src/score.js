// Projected resale economics for one event. Heuristic v1; Phase 2 recalibrates from real sales.
import { cfg } from './config.js';

const SKIP_RX = /face value exchange|non-?transferable|not transferable|cannot be transferred|no transfers?\b|resale (is )?only (available )?(on|through) ticketmaster|mobile.only.*(no|not) transfer/i;
const LEGACY_RX = /\b(farewell|final tour|anniversary|greatest hits|reunion|residency)\b/i;

export function score(f, s) {
  const notes = [];
  const flags = [];
  if (SKIP_RX.test(f.note)) flags.push('face-value-only / non-transferable');
  if (f.status && f.status !== 'onsale' && f.status !== 'offsale') flags.push(`status ${f.status}`);
  // Face price is often unpublished before the onsale: estimate from venue tier + segment and lower confidence.
  let face = f.faceMin, faceEst = false;
  if (face == null) { face = estimateFace(s.capacity, f.segment, f.genre); faceEst = true; }

  const cap = s.capacity || null;
  const fans = s.fans ?? null;
  const comedy = /comedy/i.test(f.genre) || /comedy/i.test(f.subgenre) || /comedy/i.test(f.attraction.genre);
  const theatre = f.segment === 'Arts & Theatre' && !comedy;

  // Tiered premium (resale price ÷ face), from reseller-community averages. Confidence tracks how much we actually know.
  let premium = 1.0, conf = 0.3;
  if (comedy) { premium = cap && cap <= 5000 ? 1.5 : 1.25; conf = 0.5; notes.push('comedy'); }
  else if (theatre) { premium = cap && cap <= 3000 ? 1.4 : 1.1; conf = 0.4; notes.push('theatre'); }
  else {
    if (cap && cap <= 5000) { premium = 1.6; conf = 0.5; notes.push(`small venue ${cap}`); }
    else if (cap && cap <= 20000) { premium = 1.25; conf = 0.45; notes.push(`arena ${cap}`); }
    else if (cap) { premium = 0.95; conf = 0.5; notes.push(`stadium/amphi ${cap} (oversupply risk)`); }
    // Fanbase (Deezer fans; roughly 1/10–1/20 of Spotify monthly listeners).
    if (fans != null) {
      if (fans >= 3e4 && fans <= 5e5) { premium += 0.2; conf += 0.15; notes.push(`${fmt(fans)} fans (sweet spot)`); }
      else if (fans > 5e5 && fans <= 3e6) { premium += 0.1; conf += 0.1; notes.push(`${fmt(fans)} fans (big)`); }
      else if (fans > 3e6) { if (cap && cap > 20000) premium -= 0.1; conf += 0.1; notes.push(`${fmt(fans)} fans (household name)`); }
      else if (fans >= 3e3) { premium -= 0.1; conf += 0.1; notes.push(`${fmt(fans)} fans (mid)`); }
      else { premium -= 0.3; conf += 0.1; notes.push(`${fmt(fans)} fans (thin)`); }
    } else { premium -= 0.2; notes.push('no fanbase data'); }
    if (LEGACY_RX.test(f.name)) { premium -= 0.15; notes.push('legacy/anniversary tour'); }
  }
  if ((s.sameVenueDates || 1) >= 4) { premium -= 0.2; notes.push(`${s.sameVenueDates} dates at this venue (residency, supply)`); }
  if (f.attraction.upcoming != null && f.attraction.upcoming > 60) { premium -= 0.1; notes.push(`${f.attraction.upcoming} upcoming dates (heavy supply)`); }
  if (f.attraction.upcoming != null && f.attraction.upcoming <= 12 && f.attraction.upcoming > 0) { premium += 0.1; notes.push(`${f.attraction.upcoming} dates only (scarce)`); }

  // Observed secondary market for the same act's already-on-sale dates beats any tier guess.
  const obs = s.sg?.observedPremium;
  if (obs && obs > 0.3 && obs < 6) {
    premium = premium * 0.4 + obs * 0.6; conf = Math.min(0.9, conf + 0.25);
    notes.push(`SeatGeek: other dates resell at ${obs.toFixed(2)}× face (${s.sg.events} dates, avg ${s.sg.listings} listings)`);
  }
  premium = Math.max(0.5, Math.min(3.5, premium));
  if (faceEst) { conf -= 0.15; notes.push(`face est. $${face}`); }
  if (s.capacitySource === 'guess') { conf -= 0.1; }
  conf = Math.max(0.1, Math.min(0.95, conf));

  const cost = face * (1 + cfg.buyerFee);               // cash out per ticket
  const sell = face * premium;                             // what a buyer pays for the cheapest tier
  const net = sell * (1 - cfg.sellerFee) - cost;           // per-ticket profit after marketplace cut
  const roi = cost ? net / cost : 0;
  const limit = f.ticketLimit || 4;
  const qty = face ? Math.max(0, Math.min(limit, Math.floor((cfg.bankroll * 0.3) / cost))) : 0;

  let verdict = 'SKIP';
  if (!flags.length && face > 0) verdict = roi >= cfg.buyRoi && conf >= 0.4 ? 'BUY' : roi >= cfg.watchRoi ? 'WATCH' : 'SKIP';
  const sellAt = flags.some(x => x.startsWith('face-value')) ? 'Ticketmaster Face Value Exchange only (no margin)'
    : premium >= 1.5 ? 'StubHub (biggest buyer pool) + TickPick; list within 48h, hold price'
    : 'StubHub via Lysted; reprice weekly, undercut floor 5% in the last 10 days';
  return { premium: r2(premium), confidence: r2(conf), face: r2(face), faceEst, fans, cost: r2(cost), sell: r2(sell), net: r2(net), roi: r2(roi), qty, verdict, flags, notes, sellAt };
}
// Typical cheapest-tier face price by venue size (US, 2026).
function estimateFace(cap, segment, genre) {
  if (segment === 'Arts & Theatre') return cap && cap > 3000 ? 65 : 45;
  if (!cap) return 40;
  if (cap <= 800) return 25; if (cap <= 2500) return 35; if (cap <= 6000) return 50; if (cap <= 20000) return 70; return 95;
}
const r2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n);
