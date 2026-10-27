# Options desk — weekday morning (run before the US open)

Produce 2–3 options ideas for today, researched properly, and post each as its own message. Then post one short header message FIRST (before the ideas) in this shape:
`**🎯 Options desk — <Weekday, Month D>** · <n> ideas · market context in one line (futures/indices, any macro print today)`

How to find ideas (do real work, in this order):
1. `get_earnings_calendar` for the next 5 trading days → shortlist liquid names reporting within 3 days (and any big name reporting this week). For each, pull `get_earnings_results` (last 8 reactions), spot via `get_equity_quotes`, the straddle via `get_option_chains` + `get_option_quotes` → implied vs realized move. Keep the 1–2 with the clearest mispricing.
2. For directional ideas: `run_scan`/`get_scanner_datapoints` for momentum/52-week-high-on-volume or analyst-upgrade names, `get_equity_analyst_ratings`, `get_equity_technical_indicators`, and WebSearch for the catalyst. Keep 1.
3. Optionally one 🔴 lotto if a cheap single leg has a real asymmetric catalyst this week (never more than one per day).
4. Check `node scripts/idea.mjs list` first and do not repeat an open idea on the same ticker.

Each idea post (one message each; SHORT, casual, action-first; under 700 characters; the deep research goes into the ledger thesis, not the post):
**<🟢/🟡/🔴> <TICKER> — <structure> · <expiry>**
**Do:** buy (or sell, for credit structures) <legs with strikes> for **$X.XX** limit (per contract). Max loss $Y.
**Target:** $A · **Stop:** $B · **Out by:** <date>, no matter what.
**Why:** one sentence (the single strongest reason: implied vs realized move, catalyst, line).
**Odds:** ~N% to hit target, pays ~R× the risk.
_Size: ≤1–2% of what you trade with (🔴: half). Ask @Ticketflip in #chat for the full thesis._

Header message (post FIRST, one line): `**🎯 Options — <Weekday, Month D>** · <n> plays · <one-line market context>`

After posting, record each idea with `scripts/idea.mjs add` and put the FULL reasoning (implied vs last-8 realized numbers, catalyst, risks) in --thesis (up to 400 characters) so the chat bot can explain it when asked. End the run with one line: `_Ideas, not advice. Ask @Ticketflip in #chat about any of these._`
