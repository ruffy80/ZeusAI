# Workflow automatizat pentru deploy unicorn + site pe Hetzner

Totul este complet autonom, cu protecții anti-downgrade și backup automat. Urmează acești pași pentru a lucra în siguranță și fără griji:

## 1. Lucrează doar din GitHub (branch main)
- Fă modificările local, apoi commit & push în branch-ul `main`.
- Deploy-ul pe Hetzner se face automat doar din `main`.

## 2. Protecție anti-downgrade
- Workflow-ul verifică automat versiunea din `package.json` locală vs. cea de pe server.
- Dacă versiunea locală este mai mică sau egală cu cea de pe server, deploy-ul este blocat automat.

## 3. Backup automat
- Înainte de fiecare deploy, se face backup complet al aplicației pe server (ultimele 5 backup-uri se păstrează).
- Dacă apare o problemă, poți rula rapid rollback cu:
  ```
  npm run backup:rollback
  ```
  sau direct pe server cu `bash scripts/rollback-last-backup.sh`.

## 4. Totul este autonom
- Nu edita direct pe server! Folosește doar GitHub pentru modificări.
- Orice push în `main` va declanșa automat testare, backup, verificare versiune și deploy.

## 5. Recomandări
- Testează local înainte de push.
- Folosește semantic versioning (ex: 1.2.3 → 1.2.4) la fiecare îmbunătățire.
- Pentru restaurare rapidă, folosește scriptul de rollback.

---

Sistemul este gândit să fie 100% autonom, sigur și fără riscuri de downgrade sau pierdere de date.
