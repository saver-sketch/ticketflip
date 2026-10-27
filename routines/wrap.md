# Options desk — after the close: wrap + scoreboard

1. `node scripts/idea.mjs list` → open ideas; for each get the closing mid (get_option_quotes) and spot. Close any that hit target/stop or whose exit date is today (`scripts/idea.mjs close`), with a one-line reason.
2. `node scripts/idea.mjs scoreboard` prints the record. Post ONE message:
`**🔔 Close — <Weekday, Month D>**`
one line per open idea with today's move and the standing (hold / watch),
then `**Scoreboard:** <n> ideas · <wins>-<losses> · avg <R>R · by tag: 🟢 a-b · 🟡 c-d · 🔴 e-f` and one sentence of honest takeaway (what worked, what didn't).
