# ticketflip

Concert-ticket resale radar. Polls Ticketmaster's Discovery API for upcoming presales/onsales, scores each
event's projected resale ROI from venue size, fanbase and live SeatGeek resale data, and pings a Discord
channel: a daily top-10 digest, 24h-before and 15-min-before alerts on BUY picks.

Rules it enforces by design: one Ticketmaster account, quantities capped at the posted ticket limit,
no automated purchasing. You click Buy.

```
cp .env.example .env   # fill keys
pnpm install
pnpm db:init
pnpm backtest 15       # predicted vs actual resale premium on 15 on-sale shows
pnpm poll              # one run (same thing Render runs every 15 min)
pnpm digest            # force the daily digest now
```

Deploy: Render cron job from `render.yaml` (every 15 min), env vars set in the dashboard.
