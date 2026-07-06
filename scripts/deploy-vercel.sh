#!/usr/bin/env bash
# Deploy Nova AI to Vercel.
# Usage: bash scripts/deploy-vercel.sh [--prod]
set -euo pipefail

if ! command -v vercel >/dev/null 2>&1; then
  echo "→ Installing Vercel CLI..."
  npm i -g vercel
fi

echo "→ Building project locally to validate..."
bun install
bun run build

if [[ "${1:-}" == "--prod" ]]; then
  echo "→ Deploying to PRODUCTION..."
  vercel --prod
else
  echo "→ Deploying preview (use --prod for production)..."
  vercel
fi

echo "✓ Done. Set env vars at https://vercel.com/dashboard"
