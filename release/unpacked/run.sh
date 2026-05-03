#!/bin/bash
# run.sh – Script pentru deploy automat pe Mac

set -e

echo "🚀 Pornire deploy automat..."
cd "$(dirname "$0")"

# Încarcă variabilele din .env dacă există (pentru credentiale auto)
if [ -f ".env" ]; then
  echo "🔐 Încarc credentialele din .env..."
  set -a
  # shellcheck disable=SC1091
  source ./.env
  set +a
fi

# Verifică dacă există node_modules
if [ ! -d "node_modules" ]; then
  echo "📦 Instalez dependențe..."
  npm install
fi

# Instalează @octokit/rest dacă nu există
if [ ! -d "node_modules/@octokit/rest" ]; then
  echo "📦 Instalez @octokit/rest..."
  npm install @octokit/rest
fi

# Dependințe deploy extra
if [ ! -d "node_modules/ssh2" ] || [ ! -d "node_modules/libsodium-wrappers" ]; then
  echo "📦 Instalez dependențe deploy..."
  npm install ssh2 libsodium-wrappers
fi

chmod +x deploy-unicorn.js

# Rulează scriptul de deploy
echo "🚀 Rulez deploy-unicorn.js..."
node deploy-unicorn.js

echo "✅ Deploy finalizat!"
