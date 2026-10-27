# Options desk — weekday morning (run before the US open)

Produce 2–3 options ideas for today, researched properly, and post each as its own message. Then post one short header message FIRST (before the ideas) in this shape:
`**🎯 Options desk — <Weekday, Month D>** · <n> ideas · market context in one line (futures/indices, any macro print today)`

How to find ideas (do real work, in this order):
1. `get_earnings_calendar` for the next 5 trading days → shortlist liquid names reporting within 3 days (and any big name reporting this week). For each, pull `get_earnings_results` (last 8 reactions), spot via `get_equity_quotes`, the straddle via `get_option_chains` + `get_option_quotes` → implied vs realized move. Keep the 1–2 with the clearest mispricing.
2. For directional ideas: `run_scan`/`get_scanner_datapoints` for momentum/52-week-high-on-volume or analyst-upgrade names, `get_equity_analyst_ratings`, `get_equity_technical_indicators`, and WebSearch for the catalyst. Keep 1.
3. Optionally one 🔴 lotto if a cheap single leg has a real asymmetric catalyst this week (never more than one per day).
4. Check `node scripts/idea.mjs list` first and do not repeat an open idea on the same ticker.

Each idea post (one message each, this exact section order):
**<🟢/🟡/🔴> <TICKER> — <structure> · <expiry>**
**Thesis:** 3–5 sentences with the evidence (earnings history, implied vs realized, guidance pattern, analyst/filing/news, sector).
**The trade:** legs with strikes and current bid/ask, **limit entry $X.XX** (per contract), max loss, breakeven(s).
**Implied vs expected move:** (earnings ideas) implied ±X% vs last-8 avg ±Y% / median ±Z%.
**Exit plan:** take profit at $A, stop at $B, **out by <date>** no matter what; what to do if it gaps through a level.
**Odds & payoff:** ~N% to reach target, pays ~R× the risk. **What breaks it:** one line.
**Size rule:** risk ≤1–2% of what you trade with (🔴: half).

After posting, record each idea with `scripts/idea.mjs add`. End the run with the one-line disclaimer post.
