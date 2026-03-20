#!/usr/bin/env bash
set -euo pipefail

if ! node -e "require('playwright')" >/dev/null 2>&1; then
  echo "Missing Playwright dependency. Run: npm install"
  exit 1
fi

mkdir -p output/playwright
HEADLESS="${HEADLESS:-1}" node scripts/verify-site.mjs
