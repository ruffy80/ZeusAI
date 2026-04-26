# ZeusAI / Unicorn — conectare rapidă Hetzner + push GitHub fără parolă

Totul e deja configurat pe acest MacBook. Nu mai introduci parola nicăieri.

## 1. SSH direct la Hetzner (fără parolă)

```
ssh zeusai
```

Alias configurat în `~/.ssh/config`:
- HostName: `204.168.230.142`
- User: `root`
- Key: `~/.ssh/hetzner_rsa`
- ControlMaster auto (reutilizează tunelul 10 min → conexiuni instant)

Testat: ✅ `ssh zeusai "echo OK"` răspunde fără prompt.

## 2. Push pe GitHub fără parolă

Git remote (`origin`, `zeusai`) folosește HTTPS cu credentialele **GitHub CLI**
(`gh auth status` → logat ca `ruffy80`). Push-ul merge direct, fără prompt.

```
cd /Users/ionutvladoi/Desktop/generate-unicorn
git add -A && git commit -m "..." && git push
```

## 3. Helper unic: `zeusai`

Alias shell global (adăugat în `~/.zshrc`) → `zeusai` rulează
`scripts/zeusai`. Deschide un terminal nou sau `source ~/.zshrc`.

| Comandă              | Ce face |
|----------------------|---------|
| `zeusai ssh`         | Intră pe server |
| `zeusai logs`        | `pm2 logs unicorn` live |
| `zeusai status`      | `pm2 list` + `/health` local + domain |
| `zeusai restart`     | `pm2 restart unicorn && pm2 save` |
| `zeusai exec '<cmd>'`| Rulează o comandă pe server |
| `zeusai health`      | Verifică HTTP/HTTPS `zeusai.pro` + pm2 |
| `zeusai deploy [msg]`| `git add/commit/push` pe `main` → declanșează CI/CD Hetzner |
| `zeusai pull`        | `git pull --rebase origin main` |

## 4. Deploy automat după push

Push pe `main` → workflow **`.github/workflows/deploy.yml`** (🚀 Unicorn
Stable Deploy) rulează automat:
1. Lint + teste UNICORN_FINAL
2. Build client React
3. Generează `.env` din secrete
4. Asigură SSH-key pe Hetzner
5. `rsync` la `/var/www/unicorn/` + `server-doctor.sh`
6. Health check HTTP/HTTPS `zeusai.pro`

Secretele (`HETZNER_HOST`, `HETZNER_SSH_PRIVATE_KEY`, `GH_PAT`, etc.) sunt
deja în repo. Declanșare manuală:

```
gh workflow run deploy.yml --repo ruffy80/ZeusAI
gh run watch --repo ruffy80/ZeusAI
```

## 5. Flux tipic de lucru

```
# editezi fișiere local în UNICORN_FINAL/
zeusai deploy "fix: something"       # commit + push + CI/CD pornește
zeusai health                        # confirmi că rulează
zeusai logs                          # debug live dacă e cazul
zeusai ssh                           # intri pe server pentru intervenții
```

## Troubleshooting

- Dacă `ssh zeusai` cere parolă → `ssh-add --apple-use-keychain ~/.ssh/hetzner_rsa`
- Dacă `git push` cere user/parolă → `gh auth login` sau `gh auth setup-git`
- Pentru a muta și Git pe SSH: adaugă `~/.ssh/id_ed25519.pub` în
  https://github.com/settings/keys și apoi
  `git remote set-url origin git@github.com:ruffy80/ZeusAI.git`
