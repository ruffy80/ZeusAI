# Witness contracts

A witness exists only after Search Console returns a query row. The HTML page and the JSON at the same path carry that row, the shelf price at sign time, and a delivery hash only when a public delivery file is already on disk.

The signer reads `/opt/zeusai/state/snm_private.key` and `snm_public.key`. It does not create a second keypair while those files exist.

PostgreSQL is not listening on this host (`127.0.0.1:5432` is closed). Rows are stored in SQLite at `/opt/zeusai/state/witness_contracts.sqlite` with `UNIQUE(query_text, gsc_date)`.

## Search Console

Set these in `.env` when the OAuth client exists. Do not invent them.

```
GSC_CLIENT_ID=
GSC_CLIENT_SECRET=
GSC_REFRESH_TOKEN=
GSC_SITE_URL=https://zeusai.pro/
WITNESS_SYNC_TOKEN=
WITNESS_ENABLED=true
```

Without those four GSC values, `fetchQueries` logs a warning and returns `[]`.

## Sync

`POST /witness/sync` requires `Authorization: Bearer <WITNESS_SYNC_TOKEN>`.

`modules/witness/cron.sh` is not installed in crontab. After the four GSC values work, a root crontab line can be:

```
15 4 * * * WITNESS_SYNC_TOKEN=... /opt/zeusai/UNICORN_FINAL/modules/witness/cron.sh
```
