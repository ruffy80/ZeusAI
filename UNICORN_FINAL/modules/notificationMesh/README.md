# Sovereign Notification Mesh (SNM)

Notifications try four channels, in order: WebSocket, Web Push, Nostr, then the existing SMTP mailer. SMTP is not removed. It runs only after the other three return false.

Ed25519 keys are created on first use under `/opt/zeusai/state/` (`snm_private.key` mode 600, `snm_public.key`). VAPID keys are written to `vapid.json` in that directory, mode 600. The Nostr secret is `nostr.key`, mode 600. None of those files belong in git.

The app database is SQLite, so push subscriptions live in `/opt/zeusai/state/push_subscriptions.sqlite` (`user_id`, `subscription` JSON text). PostgreSQL `SERIAL` / `JSONB` is not what this process runs.

A Nostr kind-1 event carries the type, order id, and the Ed25519 signature. It does not carry the buyer email. The full signed payload, including email, stays in the local receipt file.

`SNM_ENABLED=true` turns delivery on. In `NODE_ENV=test` it stays off unless that variable is set, so the suite does not dial public relays.

Unicorn (`backend/email.js`) and the site (`src/commerce/transactional-email.js`) both call this mesh before any SMTP send. `sendMail({ direct: true })` is the only path the SMTP channel uses, so the mailer cannot call the mesh again. Password resets, delivery links, and owner alerts set `private` so a public Nostr relay cannot count as delivery and cannot see the body. Order, payment, and service notices stay on the public chain. The site process calls `boot()` when it listens, which opens the local WebSocket. SMTP code in `backend/email.js`, `transactional-email.js`, and the older nodemailer blocks is still there for the last step and for `SNM_ENABLED=off`.
