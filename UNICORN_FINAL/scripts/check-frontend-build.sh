#!/usr/bin/env bash
# check-frontend-build.sh
# Verifică dacă frontend-ul React este construit corect și dacă serverul Node.js
# servește fișierele statice corespunzător.
# Checks whether the React frontend is correctly built and whether the Node.js
# backend serves the static files properly.
#
# Usage:
#   bash scripts/check-frontend-build.sh [--port PORT] [--skip-server]
#
# Options:
#   --port PORT      Port temporar pe care se pornește serverul (implicit: 19876)
#   --skip-server    Sari peste verificarea serverului live (doar build local)

set -euo pipefail

# ─────────────── culori / colors ───────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0
SERVER_PID=""
SERVER_LOG=""

# Cleanup on exit: stop server and remove temp log
cleanup() {
  [[ -n "${SERVER_PID}" ]] && kill "${SERVER_PID}" 2>/dev/null || true
  [[ -n "${SERVER_LOG}" && -f "${SERVER_LOG}" ]] && rm -f "${SERVER_LOG}" || true
}
trap cleanup EXIT

ok()   { echo -e "${GREEN}✅  $1${NC}";  PASS=$((PASS + 1)); }
fail() { echo -e "${RED}❌  $1${NC}";   FAIL=$((FAIL + 1)); }
info() { echo -e "${CYAN}ℹ   $1${NC}"; }
warn() { echo -e "${YELLOW}⚠   $1${NC}"; }

# ─────────────── argumente / arguments ───────────────
TEST_PORT=19876
SKIP_SERVER=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)        TEST_PORT="$2"; shift 2 ;;
    --skip-server) SKIP_SERVER=true;        shift   ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ─────────────── paths ───────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CLIENT_DIR="${APP_DIR}/client"
BUILD_DIR="${CLIENT_DIR}/build"
BACKEND_ENTRY="${APP_DIR}/backend/index.js"

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Frontend build & static-serve verification${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

# ══════════════════════════════════════════════
# 1. VERIFICARE STRUCTURĂ BUILD / BUILD STRUCTURE
# ══════════════════════════════════════════════
echo -e "${YELLOW}1) Structura directorului de build / Build directory structure${NC}"

if [[ -d "${BUILD_DIR}" ]]; then
  ok "Director build există: ${BUILD_DIR}"
else
  fail "Directorul build lipsește: ${BUILD_DIR}"
  warn "Rulează: cd ${CLIENT_DIR} && npm install && npm run build"
  echo ""
  echo -e "${RED}Verificarea build-ului a eșuat. Nu se poate continua fără build.${NC}"
  echo -e "Passed: ${PASS} | Failed: ${FAIL}"
  exit 1
fi

# index.html
if [[ -f "${BUILD_DIR}/index.html" ]]; then
  ok "index.html există"
else
  fail "index.html lipsește din build"
fi

# static/js — cel puțin un fișier JS principal
mapfile -t JS_FILES < <(find "${BUILD_DIR}/static/js" -maxdepth 1 -name "main.*.js" 2>/dev/null | sort)
if [[ ${#JS_FILES[@]} -gt 0 && -f "${JS_FILES[0]}" ]]; then
  JS_SIZE=$(wc -c < "${JS_FILES[0]}")
  if [[ "${JS_SIZE}" -gt 1024 ]]; then
    ok "Bundle JS principal găsit ($(numfmt --to=iec-i --suffix=B ${JS_SIZE} 2>/dev/null || echo "${JS_SIZE} bytes")): $(basename "${JS_FILES[0]}")"
  else
    fail "Bundle JS principal există dar este prea mic (${JS_SIZE} bytes) — build posibil corupt"
  fi
else
  fail "Niciun fișier main.*.js în ${BUILD_DIR}/static/js/"
fi

# static/css — cel puțin un fișier CSS principal
mapfile -t CSS_FILES < <(find "${BUILD_DIR}/static/css" -maxdepth 1 -name "main.*.css" 2>/dev/null | sort)
if [[ ${#CSS_FILES[@]} -gt 0 && -f "${CSS_FILES[0]}" ]]; then
  CSS_SIZE=$(wc -c < "${CSS_FILES[0]}")
  if [[ "${CSS_SIZE}" -gt 0 ]]; then
    ok "Bundle CSS principal găsit ($(numfmt --to=iec-i --suffix=B ${CSS_SIZE} 2>/dev/null || echo "${CSS_SIZE} bytes")): $(basename "${CSS_FILES[0]}")"
  else
    fail "Bundle CSS principal există dar este gol"
  fi
else
  fail "Niciun fișier main.*.css în ${BUILD_DIR}/static/css/"
fi

# asset-manifest.json — prezent după react-scripts build
if [[ -f "${BUILD_DIR}/asset-manifest.json" ]]; then
  ok "asset-manifest.json prezent"
else
  fail "asset-manifest.json lipsește (poate fi un build incomplet)"
fi

# Conținut index.html — trebuie să conțină <div id="root">
if grep -q 'id="root"' "${BUILD_DIR}/index.html" 2>/dev/null; then
  ok 'index.html conține <div id="root">'
else
  fail 'index.html nu conține <div id="root"> — conținut neașteptat'
fi

echo ""

# ══════════════════════════════════════════════
# 2. VERIFICARE SERVER NODE.JS / NODE.JS SERVER
# ══════════════════════════════════════════════
if [[ "${SKIP_SERVER}" == "true" ]]; then
  warn "Verificarea serverului live a fost omisă (--skip-server)"
  echo ""
else
  echo -e "${YELLOW}2) Servirea fișierelor statice de către serverul Node.js${NC}"

  if [[ ! -f "${BACKEND_ENTRY}" ]]; then
    fail "Fișierul de intrare al serverului nu există: ${BACKEND_ENTRY}"
  else
    # Pornire server pe portul de test
    info "Pornire server pe portul ${TEST_PORT} …"
    SERVER_LOG="$(mktemp /tmp/unicorn-server-check.XXXXXX.log)"
    PORT="${TEST_PORT}" node "${BACKEND_ENTRY}" >"${SERVER_LOG}" 2>&1 &
    SERVER_PID=$!

    # Așteptăm până la 15 secunde ca serverul să fie gata
    WAIT=0
    READY=false
    while [[ ${WAIT} -lt 15 ]]; do
      sleep 1
      WAIT=$((WAIT + 1))
      if curl -s --max-time 2 "http://127.0.0.1:${TEST_PORT}/api/health" >/dev/null 2>&1; then
        READY=true
        break
      fi
    done

    if [[ "${READY}" == "false" ]]; then
      fail "Serverul nu a pornit în 15 secunde pe portul ${TEST_PORT}"
      warn "Jurnal server: ${SERVER_LOG}"
      echo ""
      echo -e "Passed: ${PASS} | Failed: ${FAIL}"
      exit 1
    fi

    ok "Serverul Node.js a pornit (PID ${SERVER_PID}) pe portul ${TEST_PORT}"

    # ── 2a. Endpoint /api/health ────────────────────
    HEALTH_RESP=$(curl -s --max-time 5 "http://127.0.0.1:${TEST_PORT}/api/health" 2>/dev/null || echo "")
    HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:${TEST_PORT}/api/health" 2>/dev/null || echo "000")

    if [[ "${HEALTH_STATUS}" == "200" ]]; then
      ok "/api/health răspunde cu HTTP 200"
    else
      fail "/api/health a returnat HTTP ${HEALTH_STATUS}"
    fi

    if echo "${HEALTH_RESP}" | grep -qi '"ok"' || echo "${HEALTH_RESP}" | grep -qi '"status"'; then
      ok "/api/health returnează JSON valid cu câmp ok/status"
    else
      fail "/api/health nu conține câmpul ok/status în răspuns JSON"
    fi

    # ── 2b. Root URL / — HTML sau fallback JSON ─────
    ROOT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:${TEST_PORT}/" 2>/dev/null || echo "000")
    ROOT_CT=$(curl -s -o /dev/null -w "%{content_type}" --max-time 5 "http://127.0.0.1:${TEST_PORT}/" 2>/dev/null || echo "")
    ROOT_BODY=$(curl -s --max-time 5 "http://127.0.0.1:${TEST_PORT}/" 2>/dev/null || echo "")

    if [[ "${ROOT_STATUS}" == "200" ]]; then
      ok "Root URL / răspunde cu HTTP 200"
    else
      fail "Root URL / a returnat HTTP ${ROOT_STATUS}"
    fi

    if echo "${ROOT_CT}" | grep -qi "text/html"; then
      ok "Content-Type pentru / este text/html — build-ul React este servit"

      # Conținut HTML — trebuie să conțină root mount-point
      if echo "${ROOT_BODY}" | grep -q 'id="root"'; then
        ok "Răspunsul HTML conține <div id=\"root\"> (React SPA mount-point)"
      else
        fail "Răspunsul HTML nu conține <div id=\"root\">"
      fi
    else
      warn "Content-Type pentru / este '${ROOT_CT}' (nu text/html)"
      # Dacă build-ul nu există, serverul returnează JSON de fallback — nu e o eroare fatală
      if echo "${ROOT_BODY}" | grep -qi '"UI build not found"' || echo "${ROOT_BODY}" | grep -qi '"note"'; then
        warn "Serverul returnează JSON de fallback — build-ul client nu a fost găsit"
        info "Rulează: cd ${CLIENT_DIR} && npm install && npm run build, apoi repornește serverul"
      else
        fail "Răspunsul root nu este nici HTML, nici fallback JSON așteptat"
      fi
    fi

    # ── 2c. Fișier static JS ────────────────────────
    if [[ ${#JS_FILES[@]} -gt 0 && -f "${JS_FILES[0]}" ]]; then
      JS_BASENAME=$(basename "${JS_FILES[0]}")
      JS_URL="http://127.0.0.1:${TEST_PORT}/static/js/${JS_BASENAME}"
      JS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${JS_URL}" 2>/dev/null || echo "000")
      JS_CT=$(curl -s -o /dev/null -w "%{content_type}" --max-time 5 "${JS_URL}" 2>/dev/null || echo "")

      if [[ "${JS_STATUS}" == "200" ]]; then
        ok "Fișier static JS servit cu HTTP 200: /static/js/${JS_BASENAME}"
      else
        fail "Fișier static JS a returnat HTTP ${JS_STATUS}: /static/js/${JS_BASENAME}"
      fi

      if echo "${JS_CT}" | grep -qi "javascript\|application/js\|text/js"; then
        ok "Content-Type JS corect: ${JS_CT}"
      else
        fail "Content-Type JS neașteptat: '${JS_CT}' (așteptat: application/javascript)"
      fi
    else
      warn "Nu există bundle JS principal — verificarea servirii JS omisă"
    fi

    # ── 2d. Fișier static CSS ───────────────────────
    if [[ ${#CSS_FILES[@]} -gt 0 && -f "${CSS_FILES[0]}" ]]; then
      CSS_BASENAME=$(basename "${CSS_FILES[0]}")
      CSS_URL="http://127.0.0.1:${TEST_PORT}/static/css/${CSS_BASENAME}"
      CSS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${CSS_URL}" 2>/dev/null || echo "000")

      if [[ "${CSS_STATUS}" == "200" ]]; then
        ok "Fișier static CSS servit cu HTTP 200: /static/css/${CSS_BASENAME}"
      else
        fail "Fișier static CSS a returnat HTTP ${CSS_STATUS}: /static/css/${CSS_BASENAME}"
      fi
    else
      warn "Nu există bundle CSS principal — verificarea servirii CSS omisă"
    fi

    # ── 2e. Cache-Control headers ───────────────────
    if [[ ${#JS_FILES[@]} -gt 0 && -f "${JS_FILES[0]}" ]]; then
      JS_BASENAME=$(basename "${JS_FILES[0]}")
      CC_HEADER=$(curl -s -I --max-time 5 "http://127.0.0.1:${TEST_PORT}/static/js/${JS_BASENAME}" 2>/dev/null \
        | grep -i "^cache-control:" | head -1 | tr -d '\r' || echo "")
      if echo "${CC_HEADER}" | grep -qi "immutable\|max-age"; then
        ok "Cache-Control corect pentru bundle-uri statice: ${CC_HEADER#*:}"
      else
        warn "Cache-Control lipsă sau neoptimal pentru bundle-uri statice (${CC_HEADER})"
      fi
    fi

    # ── Oprire server ────────────────────────────────
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
    SERVER_PID=""
    info "Server oprit."
  fi

  echo ""
fi

# ══════════════════════════════════════════════
# SUMAR FINAL / FINAL SUMMARY
# ══════════════════════════════════════════════
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${GREEN}Trecut (Passed):  ${PASS}${NC}"
echo -e "${RED}Eșuat  (Failed):  ${FAIL}${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"

if [[ "${FAIL}" -gt 0 ]]; then
  echo -e "\n${RED}Unele verificări au eșuat. Rulează build-ul și încearcă din nou:${NC}"
  echo -e "  cd ${CLIENT_DIR} && npm install && npm run build"
  exit 1
fi

echo -e "\n${GREEN}Toate verificările au trecut. Frontend-ul este construit și servit corect.${NC}"
exit 0
