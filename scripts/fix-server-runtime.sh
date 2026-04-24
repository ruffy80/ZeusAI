#!/bin/bash
# One-shot fix: unify UNICORN_FINAL to /var/www/unicorn/UNICORN_FINAL,
# apply new ecosystem, configure logrotate, remove legacy .unicorn_temp.
set -u
cd /var/www/unicorn/UNICORN_FINAL || exit 1
mkdir -p logs snapshots

echo "=== 1. Backup current PM2 dump ==="
cp /root/.pm2/dump.pm2 /root/.pm2/dump.pm2.bak.$(date +%s) 2>/dev/null && echo "dump backed up"

echo
echo "=== 2. Archive .unicorn_temp before removal ==="
if [ -d /root/.unicorn_temp ]; then
  tar czf /root/unicorn_temp_backup_$(date +%s).tgz -C /root .unicorn_temp 2>/dev/null
  echo "archived → $(ls -lh /root/unicorn_temp_backup_*.tgz 2>/dev/null | tail -1)"
fi

echo
echo "=== 3. PM2 stop+delete all ==="
pm2 delete all 2>&1 | tail -15
pm2 kill 2>&1 | tail -3
sleep 2

echo
echo "=== 4. Start canonical ecosystem ==="
pm2 start ecosystem.config.js --update-env 2>&1 | tail -25

echo
echo "=== 5. Configure pm2-logrotate ==="
pm2 install pm2-logrotate 2>&1 | tail -3
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:rotateInterval "0 0 * * *"
pm2 set pm2-logrotate:workerInterval 300

echo
echo "=== 6. Save + ensure systemd startup ==="
pm2 save --force 2>&1 | tail -3
systemctl is-enabled pm2-root 2>&1
systemctl restart pm2-root 2>&1 | tail -3

echo
echo "=== 7. Remove .unicorn_temp ==="
rm -rf /root/.unicorn_temp
ls -d /root/.unicorn_temp 2>&1 || echo "✅ .unicorn_temp gone"

echo
echo "=== 8. PM2 list after apply ==="
sleep 5
pm2 list
