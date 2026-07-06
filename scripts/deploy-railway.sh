#!/usr/bin/env bash
# Deploy Nova AI to Railway.
# Usage: bash scripts/deploy-railway.sh
set -euo pipefail

if ! command -v railway >/dev/null 2>&1; then
  echo "→ Installing Railway CLI..."
  npm i -g @railway/cli
fi

echo "→ Logging into Railway (if needed)..."
railway whoami >/dev/null 2>&1 || railway login

if [[ ! -f .railway/project.json ]]; then
  echo "→ Initializing Railway project..."
  railway init
fi

echo "→ Deploying..."
railway up --detach

echo "✓ Done. Configure env vars: railway variables set KEY=value"
echo "  Open dashboard: railway open"
