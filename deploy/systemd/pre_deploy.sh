#!/usr/bin/env bash
set -euo pipefail

APP="${BWB_APP_NAME:-bwb}"
ETC_DIR="${BWB_ETC_DIR:-/etc/$APP}"
ENV_FILE="${BWB_ENV_FILE:-$ETC_DIR/$APP.env}"

[[ -f package-lock.json ]] || {
  echo "Refusing deployment: package-lock.json is required for reproducible installs." >&2
  exit 1
}

# Install only the locked production tree. Ignore package lifecycle scripts; run
# the one required Prisma generation step explicitly below.
npm ci --omit=dev --ignore-scripts --no-audit --no-fund

[[ -x node_modules/.bin/prisma ]] || {
  echo "Refusing deployment: locked Prisma CLI is missing from the production tree." >&2
  exit 1
}
./node_modules/.bin/prisma generate --schema=prisma/schema.prisma

# Migrations are opt-in and use the external environment file only when enabled.
MIGRATE_ON_DEPLOY=0
if [[ -r "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
  MIGRATE_ON_DEPLOY="${MIGRATE_ON_DEPLOY:-0}"
fi

if [[ "$MIGRATE_ON_DEPLOY" == "1" ]]; then
  ./node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma
fi

printf '%s\n' "Pre-deploy dependency and Prisma preparation completed."
