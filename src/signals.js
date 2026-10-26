// Cheap public demand signals. All best-effort: return null on any failure.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
async function text(url) { try { const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US' } }); return r.ok ? r.text() : null; } catch { return null; } }
const num = (s) => { if (!s) return null; const m = String(s).replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/i); if (!m) return null; const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || '').toUpperCase()] || 1; return Math.round(Number(m[1]) * mult); };

// Spotify artist page meta description: "Artist · 1.2M monthly listeners."
export async function spotifyMonthlyListeners(artistUrl) {
  if (!artistUrl) return null;
  const html = await text(artistUrl);
  const m = html?.match(/([\d.,]+\s*[KMB]?)\s*monthly listeners/i);
  return num(m?.[1]);
}
// Instagram follower count from the og:description meta ("1.2M Followers, ...").
export async function instagramFollowers(url) {
  if (!url) return null;
  const html = await text(url);
  const m = html?.match(/([\d.,]+\s*[KMB]?)\s*Followers/i);
  return num(m?.[1]);
}

// Deezer public API (no key): fan count per artist. Exact-name match only, so "Role Model" never becomes "Rolemodel".
export async function deezerFans(name) {
  if (!name) return null;
  try {
    const r = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=5`);
    if (!r.ok) return null;
    const j = await r.json();
    const n = (x) => (x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const hit = (j.data || []).find(a => n(a.name) === n(name));
    return hit ? { fans: hit.nb_fan, id: hit.id } : null;
  } catch { return null; }
}
