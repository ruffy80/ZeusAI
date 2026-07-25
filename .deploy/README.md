# `.deploy/` — OOB deploy + phone recovery

## Phone / no-MacBook recovery (Hetzner Console)

1. Open https://console.hetzner.cloud → server `204.168.230.142` → **Console**
2. Paste the contents of [`PHONE_CONSOLE_RECOVERY.sh`](./PHONE_CONSOLE_RECOVERY.sh)
3. Cloud Agent SSHes in and runs `deploy-local.sh`

Pubkey source: [`cursor-cloud-deploy_key.pub`](./cursor-cloud-deploy_key.pub)
