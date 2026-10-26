// Projected resale economics + the plain-English explanation for one event. v2 (10/26): words, not just numbers.
import { cfg } from './config.js';

const SKIP_RX = /face value exchange|non-?transferable|not transferable|cannot be transferred|no transfers?\b|resale (is )?only (available )?(on|through) ticketmaster|mobile.only.*(no|not) transfer/i;
const FVE_ACTS = /jungle|johnny blue skies|tame impala|pinkpantheress|noah kahan|olivia dean|sienna spiro/i; // 2026 Face Value Exchange tours (checked 10/26)
const LEGACY_RX = /\b(farewell|final tour|anniversary|greatest hits|reunion|residency)\b/i;
const PLAYOFF_RX = /playoff|postseason|post-season|finals?\b|championship|wild ?card|divisional|conference|game [1-7]\b|world series|stanley cup|super bowl|nba cup|march madness|sweet 16|final four|elite 8/i;
const RIVALRY_RX = /\bvs\.?\s|opening (night|day)|home opener|rivalry|derby|el cl[aá]sico/i;

export function score(f, s) {
  const notes = [], flags = [], why = [], risks = [];
  const act = f.attraction.name || f.name;
  if (SKIP_RX.test(f.note) || FVE_ACTS.test(act)) flags.push('Face Value Exchange / non-transferable: can only be resold at face, no margin');
  if (f.status && f.status !== 'onsale' && f.status !== 'offsale') flags.push(`status ${f.status}`);
  if (/vip upgrade|upgrade package|no ticket|parking|camping|shuttle|meet\s*(&|and)\s*greet|add-?on|lounge pass|fast lane|merch bundle/i.test(f.name)) flags.push('not a ticket (upgrade / parking / package)');

  let face = f.faceMin, faceEst = false;
  if (face == null) { face = estimateFace(s.capacity, f.segment, f.genre); faceEst = true; }

  const cap = s.capacity || null;
  const fans = s.fans ?? null;
  const comedy = /comedy/i.test(f.genre) || /comedy/i.test(f.subgenre) || /comedy/i.test(f.attraction.genre);
  const theatre = f.segment === 'Arts & Theatre' && !comedy;
  const sports = f.segment === 'Sports';

  let premium = 1.0, conf = 0.3;
  if (sports) {
    if (PLAYOFF_RX.test(f.name) || PLAYOFF_RX.test(f.note)) { premium = 2.2; conf = 0.5; why.push('Playoff / postseason game: these carry the biggest resale premiums of anything we track.'); }
    else if (RIVALRY_RX.test(f.name)) { premium = 1.3; conf = 0.4; why.push('Rivalry or opening-night game: sells above face but not by a mile.'); }
    else { premium = 0.9; conf = 0.5; flags.push('regular-season game: resale usually sits below face'); }
  } else if (comedy) { premium = cap && cap <= 5000 ? 1.5 : 1.25; conf = 0.5; why.push(cap && cap <= 5000 ? 'Comedy in a small room: few seats, fewer resellers competing, strong premiums after a special drops.' : 'Arena comedy: solid demand, more supply than a theater run.'); }
  else if (theatre) { premium = cap && cap <= 3000 ? 1.4 : 1.1; conf = 0.4; why.push('Limited theater run: built-in scarcity, long selling window.'); }
  else {
    if (cap && cap <= 5000) { premium = 1.6; conf = 0.5; why.push(`Small room (about ${fmt(cap)} seats): sellouts happen fast and resale demand has nowhere else to go.`); }
    else if (cap && cap <= 20000) { premium = 1.25; conf = 0.45; why.push(`Arena-size room (about ${fmt(cap)} seats): needs a real fanbase to clear at a premium.`); }
    else if (cap) { premium = 0.95; conf = 0.5; why.push(`Stadium / amphitheater (about ${fmt(cap)} seats): usually oversupplied, prices fall toward show day.`); risks.push('Stadium shows get oversupplied; late sellers undercut each other.'); }
    if (fans != null) {
      if (fans >= 3e4 && fans <= 5e5) { premium += 0.2; conf += 0.15; why.push(`Fanbase is in the sweet spot (${fmt(fans)} Deezer fans): big enough to sell out a room, not big enough to be playing stadiums.`); }
      else if (fans > 5e5 && fans <= 3e6) { premium += 0.1; conf += 0.1; why.push(`Big fanbase (${fmt(fans)} Deezer fans).`); }
      else if (fans > 3e6) { if (cap && cap > 20000) premium -= 0.1; conf += 0.1; why.push(`Household name (${fmt(fans)} Deezer fans): demand is there, so is supply.`); }
      else if (fans >= 3e3) { premium -= 0.1; conf += 0.1; why.push(`Mid-size fanbase (${fmt(fans)} Deezer fans): fine in a club, risky anywhere bigger.`); }
      else { premium -= 0.3; conf += 0.1; risks.push(`Thin fanbase (${fmt(fans)} Deezer fans): this may not sell out at all.`); }
    } else { premium -= 0.2; risks.push('No fanbase data found for this act.'); }
    if (LEGACY_RX.test(f.name)) { premium -= 0.15; risks.push('Farewell / anniversary / residency tours get flooded with supply.'); }
  }
  if ((s.sameVenueDates || 1) >= 4) { premium -= 0.2; risks.push(`${s.sameVenueDates} dates at the same venue: plenty of supply, little urgency.`); }
  if (f.attraction.upcoming != null && f.attraction.upcoming > 60) { premium -= 0.1; risks.push(`${f.attraction.upcoming} upcoming dates on this tour: buyers can always find another night.`); }
  if (f.attraction.upcoming != null && f.attraction.upcoming <= 12 && f.attraction.upcoming > 0) { premium += 0.1; why.push(f.attraction.upcoming === 1 ? 'One-off show, no other dates to compete with.' : `Only ${f.attraction.upcoming} dates on the tour: scarcity works for us.`); }

  // Observed secondary market (Gametime listings on the same act's on-sale dates) beats any tier guess.
  const obs = s.resale?.p25 && face ? s.resale.p25 / face : null;
  let observed = null, listings = null;
  if (obs && obs > 0.3 && obs < 8) {
    observed = r2(obs); listings = s.resale.listings;
    const thin = (s.resale.listings || 0) < 5;
    premium = premium * (thin ? 0.6 : 0.35) + obs * (thin ? 0.4 : 0.65); conf = Math.min(0.9, conf + (thin ? 0.1 : 0.3));
    why.unshift(`Real evidence: this act's other dates are reselling right now. Cheapest quarter of listings sits at $${s.resale.p25} (${obs.toFixed(1)}× the ${faceEst ? 'estimated' : ''} face of $${face}), about ${s.resale.listings} listings per date across ${s.resale.sampled} dates${thin ? ' (small sample, so take it lightly)' : ''}.`);
    if (s.resale.listings > 150) { premium -= 0.15; risks.push('Heavy resale supply already (150+ listings per date): expect undercutting.'); }
  } else if (s.resale && s.resale.events && !s.resale.median) { notes.push('on Gametime but no listings yet'); }
  else { risks.push('No resale listings to compare against yet; this is a model estimate, not observed prices.'); }
  premium = Math.max(0.5, Math.min(3.5, premium));
  if (faceEst) conf -= 0.15;
  if (s.capacitySource === 'guess') conf -= 0.1;
  conf = Math.max(0.1, Math.min(0.95, conf));

  const cost = r2(face * (1 + cfg.buyerFee));
  const sell = r2(face * premium);
  const net = r2(sell * (1 - cfg.sellerFee) - cost);
  const roi = cost ? r2(net / cost) : 0;
  const limit = f.ticketLimit || 4;
  const qty = face ? Math.max(0, Math.min(limit, Math.floor((cfg.bankroll * 0.3) / cost))) : 0;

  let verdict = 'SKIP';
  if (!flags.length && face > 0) verdict = roi >= cfg.buyRoi && conf >= 0.4 ? 'BUY' : roi >= cfg.watchRoi ? 'WATCH' : 'SKIP';
  let buyIfFace = null;
  if (faceEst && verdict === 'BUY') { verdict = 'WATCH'; buyIfFace = Math.floor(sell * (1 - cfg.sellerFee) / ((1 + cfg.buyerFee) * (1 + cfg.buyRoi))); }
  if (faceEst) risks.unshift(`Ticketmaster hasn't published the price yet. $${face} is our estimate for the cheapest tier${buyIfFace ? `; this is a BUY only if the cheapest tier is $${buyIfFace} or less` : ''}.`);
  if (conf < 0.4 && verdict !== 'SKIP') verdict = 'SKIP';

  const label = conf >= 0.7 ? 'Strong evidence' : conf >= 0.4 ? 'Some evidence' : 'Guess';
  const fve = flags.some(x => /Face Value/.test(x));
  const sellRank = fve ? [{ name: 'Ticketmaster Face Value Exchange', why: 'the only place these can be resold, at face only', url: f.url }]
    : [
      { name: 'StubHub', why: 'biggest buyer pool, best for in-demand shows', url: 'https://www.stubhub.com/sell' },
      { name: 'TickPick', why: 'no buyer fees, so your price looks cheapest to shoppers', url: 'https://www.tickpick.com/sell-tickets' },
      ...(/ticketmaster\.com/.test(f.url || '') ? [{ name: 'Ticketmaster resale', why: 'buyers see it inside the Ticketmaster app; use it when transfer is locked', url: f.url }] : []),
      { name: 'Gametime', why: 'last-minute mobile buyers in the final 48 hours', url: 'https://gametime.co/sell' },
    ];
  const exit = { list: Math.round(sell), mid: Math.round(Math.max(sell * 0.85, cost * 1.1)), floor: Math.round(Math.max(cost * 1.05, s.resale?.floor || 0)) };
  const code = codeSource(f);
  const tier = sports ? 'Buy the cheapest seats in the section with the lowest price; upper-level corners resell by percentage just as well.' : 'Buy the cheapest price tier (usually GA floor or the lowest-priced section). Skip VIP and Platinum: no margin on those.';

  return { premium: r2(premium), confidence: r2(conf), label, face: r2(face), faceEst, buyIfFace, fans, observed, listings, cost, sell, net, roi, qty, limit, bankroll: r2(cost * qty), verdict, flags, notes, why, risks, sellRank, exit, code, tier, sellAt: sellRank[0].name };
}

// What a member has to do to get into each presale, from Ticketmaster's presale names.
function codeSource(f) {
  const out = [];
  for (const p of f.presales || []) {
    const n = `${p.name} ${p.description || ''}`;
    let how;
    if (/verified fan/i.test(n)) how = `Register for Verified Fan first${p.url ? ` → ${p.url}` : ''}; the code comes by text before the window opens.`;
    else if (/citi/i.test(n)) how = 'Citi card presale: link your Citi card at citientertainment.com, or type the first 6 digits of your Citi card as the code. Pay with that card.';
    else if (/amex|american express/i.test(n)) how = 'Amex presale: no code. Just pay with an American Express card.';
    else if (/capital one/i.test(n)) how = 'Capital One presale: sign in with a Capital One card linked to your Ticketmaster account.';
    else if (/live ?nation|\bLN\b/i.test(n)) how = 'Live Nation presale: sign in to Ticketmaster with a Live Nation account; the code is usually posted on Live Nation\'s socials the morning of (often just "LIVENATION" style words).';
    else if (/artist|fan club|mailing|newsletter|official/i.test(n)) how = `Artist presale: the code comes from the artist's mailing list${f.attraction.instagram ? ` (sign up via ${f.attraction.instagram})` : ''}. Sign up today.`;
    else if (/venue|local|radio|spotify|promoter|chase|visa|mastercard/i.test(n)) how = 'Venue / radio / card presale: code is posted by that venue, station or card on their socials or newsletter the day before.';
    else how = 'Check the "Presales" section on the Ticketmaster event page the morning of; most of these codes are posted publicly.';
    out.push({ name: p.name, start: p.start, end: p.end, url: p.url || f.url, how });
  }
  return out;
}
function estimateFace(cap, segment) {
  if (segment === 'Sports') return cap && cap > 20000 ? 60 : 45;
  if (segment === 'Arts & Theatre') return cap && cap > 3000 ? 65 : 45;
  if (!cap) return 40;
  if (cap <= 800) return 25; if (cap <= 2500) return 35; if (cap <= 6000) return 50; if (cap <= 20000) return 70; return 95;
}
const r2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n);
