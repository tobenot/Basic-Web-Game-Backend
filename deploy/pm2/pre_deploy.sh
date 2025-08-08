#!/usr/bin/env bash
set -euo pipefail

APP="bwb"
ETC_DIR="/etc/$APP"

# Ensure env is loaded for DATABASE_URL and other secrets
if [[ -f "$ETC_DIR/$APP.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ETC_DIR/$APP.env"
  set +a
fi

# Install production dependencies
if [[ -f package-lock.json ]]; then
  npm ci --omit=dev
else
  npm i --production
fi

# Run Prisma migrations if enabled
if [[ "${MIGRATE_ON_DEPLOY:-0}" == "1" ]]; then
  echo "Running Prisma migrations (deploy)..."
  npx prisma migrate deploy
fi

echo "Pre-deploy done"