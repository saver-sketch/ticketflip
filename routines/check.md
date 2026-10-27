# Options desk — midday check (US market hours)

1. `node scripts/idea.mjs list` → open ideas.
2. For each: get the current contract mid (get_option_quotes by the legs; for spreads compute the net) and spot. Compare to entry, target, stop, exit date.
3. Decide: **hold** / **take profit** (at or past target) / **cut** (at or past stop, or thesis broken by news: do one WebSearch per ticker) / **out today** (exit date reached).
4. Post ONE message only if something changed or a level was hit; otherwise post nothing. Format: `**🕛 Midday check**` then one line per idea: `TICKER structure · entry $X → now $Y (+Z%) · target $A / stop $B · **HOLD|TAKE PROFIT|CUT** — reason`.
5. For take-profit/cut/out-today: `node scripts/idea.mjs close --id <id> --price <current mid> --notes "<reason>"`.
