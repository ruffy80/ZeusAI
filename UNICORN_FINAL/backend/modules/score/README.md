# Business score loop

`POST /api/score` fetches the URL, scores five HTTP checks, signs a witness with the existing SNM Ed25519 key, and records a public ledger row that does not count as a paid human.

Prices for the full report and the website audit come from `priceNegotiator.getPrice`. If that module does not return a number, the response leaves the price null.

Search Console credentials are not required for a score. A score is not a Search Console query. `/witness` labels score contracts as scores.

PostgreSQL is not listening on this host. Scores and viral events are stored in SQLite at `/opt/zeusai/state/business_scores.sqlite`.

`SCORE_ENABLED=true`  
`SCORE_PUBLIC_BASE_URL=https://zeusai.pro`  
`SCORE_MAX_PER_IP_PER_DAY=3`  
`SCORE_CACHE_DAYS=7`  
`SCORE_FOUNDING_LIMIT=100`

The leaderboard lists only rows stored with `opt_in: true`. An empty leaderboard is an empty list.
