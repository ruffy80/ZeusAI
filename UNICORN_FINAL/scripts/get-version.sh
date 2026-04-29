#!/usr/bin/env bash
set -euo pipefail

# Script: get-version.sh
# Return the current version from package.json in the working directory

if [ ! -f package.json ]; then
  echo "0.0.0"
  exit 0
fi

VERSION=$(grep '"version"' package.json | head -1 | sed -E 's/.*"([0-9]+\.[0-9]+\.[0-9]+)".*/\1/')
echo "$VERSION"
