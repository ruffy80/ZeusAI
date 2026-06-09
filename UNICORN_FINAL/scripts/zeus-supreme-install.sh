#!/usr/bin/env bash
# =====================================================================
# OWNERSHIP: Vladoi Ionut  <vladoi_ionut@yahoo.com>
# BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
# =====================================================================
# ZEUS SUPREME — Bicameral autonomous brain installer (idempotent)
#
# EN: Binds the two hemispheres of the ZeusAI mind into ONE coherent,
#     self-healing organism under a single systemd target:
#       * BRAINSTEM  = autonomous_oracle.py   (root reflexes / OS self-heal)
#       * CORTEX     = deepseek-unified.js     (governor-safe engineering)
#     They communicate through data/zeus-consciousness.json (corpus callosum).
#     The installer also retires the duplicate advisory loop and reaps three
#     ghost services that were wasting CPU and spamming logs.
#
# RO: Unește cele două emisfere ale minții ZeusAI într-un singur organism
#     coerent, auto-vindecător, sub un singur target systemd. Comunică prin
#     fișierul de conștiință partajat. Curăță și serviciile-fantomă.
#
# Idempotent: safe to run repeatedly. No secrets are written here; both
# units read the existing EnvironmentFile (.env).
# =====================================================================
set -uo pipefail

ROOT="${ZEUS_ROOT:-/var/www/unicorn/UNICORN_FINAL}"
ENV_FILE="${ROOT}/.env"
SCRIPTS="${ROOT}/scripts"
NODE_BIN="$(command -v node || echo /usr/bin/node)"
PY_BIN="$(command -v python3 || echo /usr/bin/python3)"
SYSTEMD_DIR="/etc/systemd/system"

log() { printf '[zeus-supreme] %s\n' "$*"; }

log "ROOT=${ROOT}"
log "node=${NODE_BIN} python3=${PY_BIN}"

# ---------------------------------------------------------------------
# 1) BRAINSTEM unit — autonomous_oracle.py (root reflexes)
# ---------------------------------------------------------------------
cat > "${SYSTEMD_DIR}/zeus-brainstem.service" <<UNIT
[Unit]
Description=ZeusAI Brainstem — autonomous reflex oracle (self-heal hemisphere)
After=network-online.target
Wants=network-online.target
PartOf=zeus-supreme.target

[Service]
Type=simple
WorkingDirectory=${ROOT}
EnvironmentFile=-${ENV_FILE}
EnvironmentFile=-/etc/zeusai/secrets/ai-keys.env
Environment=ORACLE_INTERVAL=60
Environment=ORACLE_DEEPSEEK_ENABLED=1
ExecStart=${PY_BIN} ${SCRIPTS}/autonomous_oracle.py
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=zeus-supreme.target
UNIT
log "wrote zeus-brainstem.service"

# ---------------------------------------------------------------------
# 2) CORTEX unit — deepseek-unified.js (governor-safe engineering)
#    Enable execute+autonomy via inline Environment so it actually works
#    even if the .env flags differ. Governor allowlist still bounds it.
# ---------------------------------------------------------------------
cat > "${SYSTEMD_DIR}/zeus-cortex.service" <<UNIT
[Unit]
Description=ZeusAI Cortex — DeepSeek unified engineering hemisphere
After=network-online.target zeus-brainstem.service
Wants=network-online.target
PartOf=zeus-supreme.target

[Service]
Type=simple
WorkingDirectory=${ROOT}
EnvironmentFile=-${ENV_FILE}
EnvironmentFile=-/etc/zeusai/secrets/ai-keys.env
Environment=DEEPSEEK_UNIFIED_ENABLED=1
Environment=DEEPSEEK_LOOP_ENABLED=1
Environment=DEEPSEEK_LOOP_EXECUTE=1
Environment=DEEPSEEK_UNIFIED_MEMORY_SIZE=10
Environment=DEEPSEEK_MODEL=deepseek-chat
ExecStart=${NODE_BIN} ${SCRIPTS}/deepseek-unified.js
Restart=always
RestartSec=8
User=root

[Install]
WantedBy=zeus-supreme.target
UNIT
log "wrote zeus-cortex.service"

# ---------------------------------------------------------------------
# 3) SUPREME target — binds both hemispheres as one organism
# ---------------------------------------------------------------------
cat > "${SYSTEMD_DIR}/zeus-supreme.target" <<UNIT
[Unit]
Description=ZeusAI Supreme — bicameral autonomous brain (brainstem + cortex)
Requires=zeus-brainstem.service zeus-cortex.service
After=zeus-brainstem.service zeus-cortex.service
AllowIsolate=no

[Install]
WantedBy=multi-user.target
UNIT
log "wrote zeus-supreme.target"

# ---------------------------------------------------------------------
# 4) Retire the DUPLICATE / superseded units (unconditional, idempotent).
#    deepseek-unified.js is a strict superset of deepseek-loop.js, and the
#    cortex/brainstem units now own the two daemons. These old units carry
#    `Restart=on-failure` and exit non-zero on SIGTERM, so a plain stop lets
#    them respawn a duplicate process that fights our cortex over the
#    governor + consciousness file. `systemctl mask` also fails for them
#    because their REAL unit file lives in /etc/systemd/system/, so we move
#    the file aside (reversible: *.superseded) to make the unit truly vanish.
# ---------------------------------------------------------------------
for u in deepseek-loop.service autonomous-oracle.service deepseek-unified.service; do
  systemctl stop "$u" 2>/dev/null && log "stopped superseded $u" || true
  systemctl disable "$u" 2>/dev/null || true
  if systemctl mask "$u" 2>/dev/null; then
    log "masked superseded $u"
  else
    # Mask refused (real file present) — move the unit file aside instead.
    for d in /etc/systemd/system /lib/systemd/system /usr/lib/systemd/system; do
      if [ -f "$d/$u" ] && [ ! -L "$d/$u" ]; then
        mv "$d/$u" "$d/$u.superseded" 2>/dev/null && log "moved aside $d/$u -> $u.superseded"
      fi
    done
  fi
done
systemctl daemon-reload
# Kill any lingering duplicate deepseek-unified.js NOT owned by zeus-cortex.
CORTEX_PID="$(systemctl show zeus-cortex.service -p ExecMainPID --value 2>/dev/null)"
for pid in $(pgrep -f 'scripts/deepseek-unified.js' 2>/dev/null); do
  if [ -n "$pid" ] && [ "$pid" != "$CORTEX_PID" ]; then
    kill -TERM "$pid" 2>/dev/null && log "killed duplicate cortex PID $pid (keeping $CORTEX_PID)"
  fi
done

# ---------------------------------------------------------------------
# 5) GHOST CLEANUP — three undead services found on the host.
# ---------------------------------------------------------------------
# 5a) Phantom zeus-watchdog: unit deleted but orphan node PID lingers.
GHOST_PIDS="$(ps -eo pid,cmd | grep -i 'zeus-watchdog' | grep -v grep | awk '{print $1}')"
if [ -n "${GHOST_PIDS}" ]; then
  for pid in ${GHOST_PIDS}; do
    kill -TERM "${pid}" 2>/dev/null && log "reaped phantom zeus-watchdog PID ${pid}"
  done
fi
systemctl reset-failed zeus-watchdog.service 2>/dev/null || true

# 5b) server-doctor: failed 203/EXEC (bad ExecStart path). Neutralize.
#     Replaced by the brainstem's deterministic self-heal reflexes.
systemctl stop server-doctor.timer 2>/dev/null || true
systemctl disable server-doctor.timer 2>/dev/null || true
systemctl stop server-doctor.service 2>/dev/null || true
systemctl reset-failed server-doctor.service 2>/dev/null || true
log "neutralized broken server-doctor (replaced by brainstem reflexes)"

# 5c) zeusai-autonomy: noisy oneshot that flaps. Disable triggers.
systemctl stop zeusai-autonomy.timer 2>/dev/null || true
systemctl disable zeusai-autonomy.timer 2>/dev/null || true
systemctl reset-failed zeusai-autonomy.service 2>/dev/null || true
log "quieted flapping zeusai-autonomy oneshot"

# ---------------------------------------------------------------------
# 6) Activate the supreme brain.
# ---------------------------------------------------------------------
mkdir -p "${ROOT}/data"
systemctl daemon-reload
systemctl enable zeus-brainstem.service zeus-cortex.service zeus-supreme.target 2>/dev/null || true
systemctl restart zeus-brainstem.service
sleep 2
systemctl restart zeus-cortex.service
systemctl start zeus-supreme.target 2>/dev/null || true

log "----- STATUS -----"
for u in zeus-brainstem.service zeus-cortex.service; do
  printf '[zeus-supreme] %-26s %s\n' "${u}" "$(systemctl is-active ${u} 2>/dev/null)"
done
log "supreme brain online."
