#!/bin/bash
# verify-frontend-build.sh
# Verifică dacă frontend-ul React este construit corect și dacă
# serverul Node.js (backend/index.js) servește fișierele statice.
#
# Utilizare:
#   bash UNICORN_FINAL/scripts/verify-frontend-build.sh
#   (sau din directorul UNICORN_FINAL): bash scripts/verify-frontend-build.sh

set -euo pipefail

# ---------------------------------------------------------------------------
# Culori și utilitare
# ---------------------------------------------------------------------------
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
SERVER_PID=""

ok()   { echo -e "${GREEN}✅  $1${NC}"; PASS=$((PASS + 1)); }
ko()   { echo -e "${RED}❌  $1${NC}"; FAIL=$((FAIL + 1)); }
info() { echo -e "${BLUE}ℹ️   $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️   $1${NC}"; }

# ---------------------------------------------------------------------------
# Cleanup la ieșire — oprește serverul dacă a fost pornit
# ---------------------------------------------------------------------------
cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    info "Oprire server de test (PID $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Rezolvă calea spre directorul UNICORN_FINAL indiferent de unde se rulează
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNICORN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

CLIENT_DIR="$UNICORN_DIR/client"
CLIENT_BUILD_DIR="$CLIENT_DIR/build"
BACKEND_ENTRY="$UNICORN_DIR/backend/index.js"

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}  Verificare build frontend + server Node.js${NC}"
echo -e "${BLUE}======================================================${NC}\n"

# ---------------------------------------------------------------------------
# 1. Verifică existența directorului client/
# ---------------------------------------------------------------------------
echo "1) Director client React"

if [ -d "$CLIENT_DIR" ]; then
  ok "Directorul client/ există ($CLIENT_DIR)"
else
  ko "Directorul client/ lipsește ($CLIENT_DIR)"
fi

if [ -f "$CLIENT_DIR/package.json" ]; then
  ok "client/package.json există"
else
  ko "client/package.json lipsește"
fi

# ---------------------------------------------------------------------------
# 2. Verifică artefactele build-ului React (client/build/)
# ---------------------------------------------------------------------------
echo -e "\n2) Artefacte build React (client/build/)"

if [ -d "$CLIENT_BUILD_DIR" ]; then
  ok "Directorul client/build/ există"
else
  ko "Directorul client/build/ lipsește — rulează: cd client && npm install && npm run build"
fi

if [ -f "$CLIENT_BUILD_DIR/index.html" ]; then
  ok "client/build/index.html există"
else
  ko "client/build/index.html lipsește"
fi

if [ -d "$CLIENT_BUILD_DIR/static" ]; then
  ok "Directorul client/build/static/ există"
else
  ko "Directorul client/build/static/ lipsește"
fi

# Verifică că există cel puțin un bundle JS
if compgen -G "$CLIENT_BUILD_DIR/static/js/main.*.js" > /dev/null 2>&1; then
  JS_BUNDLE=$(ls "$CLIENT_BUILD_DIR/static/js/main".*.js 2>/dev/null | head -1)
  ok "Bundle JS principal găsit: $(basename "$JS_BUNDLE")"
else
  ko "Niciun bundle JS principal (main.*.js) găsit în client/build/static/js/"
fi

# Verifică că există cel puțin un bundle CSS
if compgen -G "$CLIENT_BUILD_DIR/static/css/main.*.css" > /dev/null 2>&1; then
  CSS_BUNDLE=$(ls "$CLIENT_BUILD_DIR/static/css/main".*.css 2>/dev/null | head -1)
  ok "Bundle CSS principal găsit: $(basename "$CSS_BUNDLE")"
else
  ko "Niciun bundle CSS principal (main.*.css) găsit în client/build/static/css/"
fi

# Verifică dimensiunea index.html (să nu fie gol)
if [ -f "$CLIENT_BUILD_DIR/index.html" ]; then
  HTML_SIZE=$(wc -c < "$CLIENT_BUILD_DIR/index.html" 2>/dev/null || echo 0)
  if [ "$HTML_SIZE" -gt 100 ]; then
    ok "client/build/index.html are conținut valid (${HTML_SIZE} octeți)"
  else
    ko "client/build/index.html pare gol sau corupt (${HTML_SIZE} octeți)"
  fi
fi

# ---------------------------------------------------------------------------
# 3. Verifică că backend-ul Node.js există
# ---------------------------------------------------------------------------
echo -e "\n3) Server Node.js (backend/index.js)"

if [ -f "$BACKEND_ENTRY" ]; then
  ok "backend/index.js există"
else
  ko "backend/index.js lipsește ($BACKEND_ENTRY)"
  echo -e "\n${RED}Eroare fatală: nu se poate porni serverul de test.${NC}"
  echo -e "Passed: ${PASS} | Failed: ${FAIL}"
  exit 1
fi

# Verifică sintaxa Node.js
if node --check "$BACKEND_ENTRY" 2>/dev/null; then
  ok "Sintaxă Node.js validă (node --check)"
else
  ko "Erori de sintaxă în backend/index.js"
fi

# ---------------------------------------------------------------------------
# 4. Pornește serverul pe un port liber și testează servirea
# ---------------------------------------------------------------------------
echo -e "\n4) Server activ — servire fișiere statice"

# Găsește un port liber
TEST_PORT=$(node -e "
  const net = require('net');
  const srv = net.createServer();
  srv.listen(0, '127.0.0.1', () => {
    process.stdout.write(String(srv.address().port));
    srv.close();
  });
" 2>/dev/null)

if [ -z "$TEST_PORT" ]; then
  warn "Nu s-a putut determina un port liber. Se folosește 13001."
  TEST_PORT=13001
fi

info "Pornire server pe portul $TEST_PORT..."

cd "$UNICORN_DIR"
PORT="$TEST_PORT" node backend/index.js > /tmp/unicorn-server-test.log 2>&1 &
SERVER_PID=$!

# Așteaptă până la 10 secunde ca serverul să fie gata
READY=0
for i in $(seq 1 20); do
  sleep 0.5
  if curl -s -o /dev/null "http://127.0.0.1:${TEST_PORT}/api/health" 2>/dev/null; then
    READY=1
    break
  fi
done

if [ "$READY" -eq 0 ]; then
  ko "Serverul nu a răspuns în 10 secunde pe portul $TEST_PORT"
  info "Log server:"
  cat /tmp/unicorn-server-test.log || true
else
  ok "Serverul a pornit și răspunde pe portul $TEST_PORT"

  # --- Verifică /api/health ---
  HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${TEST_PORT}/api/health")
  if [ "$HEALTH_STATUS" = "200" ]; then
    ok "GET /api/health → HTTP $HEALTH_STATUS"
  else
    ko "GET /api/health → HTTP $HEALTH_STATUS (așteptat 200)"
  fi

  # Verifică că /api/health returnează JSON cu status ok
  HEALTH_BODY=$(curl -s "http://127.0.0.1:${TEST_PORT}/api/health" 2>/dev/null || echo "")
  if echo "$HEALTH_BODY" | grep -q '"status"'; then
    ok "/api/health returnează JSON cu câmpul status"
  else
    ko "/api/health nu returnează JSON valid (răspuns: ${HEALTH_BODY:0:80})"
  fi

  # --- Verifică că root-ul servește frontend-ul sau un JSON de fallback ---
  ROOT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${TEST_PORT}/")
  if [ "$ROOT_STATUS" = "200" ]; then
    ok "GET / → HTTP $ROOT_STATUS"
  else
    ko "GET / → HTTP $ROOT_STATUS (așteptat 200)"
  fi

  ROOT_CONTENT_TYPE=$(curl -s -I "http://127.0.0.1:${TEST_PORT}/" 2>/dev/null | grep -i "content-type" | head -1 || echo "")

  if [ -d "$CLIENT_BUILD_DIR" ] && [ -f "$CLIENT_BUILD_DIR/index.html" ]; then
    # Build-ul există — serverul trebuie să servească HTML
    if echo "$ROOT_CONTENT_TYPE" | grep -qi "text/html"; then
      ok "GET / returnează text/html (fișierele statice sunt servite corect)"
    else
      ko "GET / nu returnează text/html — Content-Type: ${ROOT_CONTENT_TYPE:-necunoscut}"
    fi

    # Verifică că HTML-ul conține referințe la bundle-ul React
    ROOT_BODY=$(curl -s "http://127.0.0.1:${TEST_PORT}/" 2>/dev/null || echo "")
    if echo "$ROOT_BODY" | grep -q "static/js"; then
      ok "HTML servit conține referințe la bundle-urile JS (static/js)"
    else
      ko "HTML servit nu conține referințe la bundle-urile JS"
    fi

    # Verifică că un fișier static (JS) este servit corect
    if [ -n "${JS_BUNDLE:-}" ]; then
      BUNDLE_NAME=$(basename "$JS_BUNDLE")
      STATIC_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${TEST_PORT}/static/js/${BUNDLE_NAME}")
      if [ "$STATIC_STATUS" = "200" ]; then
        ok "GET /static/js/${BUNDLE_NAME} → HTTP $STATIC_STATUS (bundle JS servit)"
      else
        ko "GET /static/js/${BUNDLE_NAME} → HTTP $STATIC_STATUS (bundle JS inaccesibil)"
      fi
    fi
  else
    # Build-ul lipsește — serverul trebuie să returneze JSON de fallback
    if echo "$ROOT_CONTENT_TYPE" | grep -qi "application/json"; then
      ok "GET / returnează JSON de fallback (build-ul lipsește, dar serverul funcționează)"
    else
      warn "Build-ul lipsește. GET / a returnat Content-Type: ${ROOT_CONTENT_TYPE:-necunoscut}"
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Sumar
# ---------------------------------------------------------------------------
echo -e "\n${BLUE}======================================================${NC}"
echo -e "Sumar rezultate:"
echo -e "  ${GREEN}Trecut:  $PASS${NC}"
echo -e "  ${RED}Eșuat:   $FAIL${NC}"
echo -e "${BLUE}======================================================${NC}"

if [ "$FAIL" -gt 0 ]; then
  echo -e "\n${YELLOW}Rezolvă verificările eșuate și rulează din nou:${NC}"
  echo "  bash UNICORN_FINAL/scripts/verify-frontend-build.sh"
  exit 1
fi

echo -e "\n${GREEN}Toate verificările au trecut. Frontend-ul este construit și serverul servește fișierele statice corect.${NC}"
