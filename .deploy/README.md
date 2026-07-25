# `.deploy/` — OOB deploy + phone recovery

## Phone / no-MacBook recovery (Hetzner Console)

1. Open https://console.hetzner.cloud → server `204.168.230.142` → **Console**
2. Login as `root`
3. Paste the **entire** contents of [`PHONE_CONSOLE_RECOVERY.sh`](./PHONE_CONSOLE_RECOVERY.sh)
   (hardcoded keys — no curl / no MacBook)
4. Cloud Agent SSHes in within ~1 min and runs `deploy-local.sh`

Pubkey source: [`cursor-cloud-deploy_key.pub`](./cursor-cloud-deploy_key.pub)

## Phoenix Trust Sync (after next promote)

`scripts/zeus-trust-sync.sh` runs on **every** autodeploy tick — even when
`/etc/zeus-autodeploy.disabled` is set — and installs pubkeys from this folder
into root `authorized_keys`. It never clears the kill-switch by itself.

## Cursor Secret gotcha

`HETZNER_SSH_PRIVATE_KEY` in Cursor must be the **production** key
(`unicorn-hetzner`, pubkey ends with `…HI/s3nuy`), NOT a freshly generated
recover key. The matching private key lives in GitHub Actions secrets and on
the owner Mac (`hetzner_rsa` / unicorn-hetzner). A recover-only secret cannot
SSH until its pubkey is installed via console paste above.
