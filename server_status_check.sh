#!/bin/bash

# Verificare stare SSH
sudo systemctl status ssh
sudo grep ^Port /etc/ssh/sshd_config

# Verificare firewall (UFW)
sudo ufw status

# Verificare procese unicorn/pm2
ps aux | grep unicorn
pm2 status

# Verificare nginx (daca exista)
sudo systemctl status nginx

# Loguri sistem
sudo tail -n 50 /var/log/syslog 2>/dev/null || sudo tail -n 50 /var/log/messages 2>/dev/null

# Loguri unicorn (daca exista)
find / -type f -name "*.log" 2>/dev/null | grep -i unicorn | xargs -r tail -n 20
