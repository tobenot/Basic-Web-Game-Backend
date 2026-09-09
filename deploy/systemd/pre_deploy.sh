#!/usr/bin/env bash
set -euo pipefail

APP="${BWB_APP_NAME:-bwb}"
ETC_DIR="${BWB_ETC_DIR:-/etc/$APP}"
ENV_FILE="${BWB_ENV_FILE:-$ETC_DIR/$APP.env}"

# `su - <app-user>` starts a login shell whose PATH may not contain the
# administrator's Node installation. Resolve Node first, then derive npm's
# directory from the real binary rather than trusting a root-owned nvm symlink.
NODE_BIN="${BWB_NODE_BIN:-}"
if [[ -z "$NODE_BIN" ]]; then
  for candidate in /opt/node22/bin/node /usr/local/bin/node /usr/bin/node /bin/node; do
    if [[ -x "$candidate" ]]; then
      NODE_BIN="$candidate"
      break
    fi
  done
fi
[[ -n "$NODE_BIN" && -x "$NODE_BIN" ]] || {
  echo "Refusing deployment: no executable Node.js runtime was found." >&2
  echo "Set BWB_NODE_BIN to the app user's readable Node binary." >&2
  exit 1
}
NODE_BIN="$(readlink -f "$NODE_BIN")"
NODE_DIR="$(dirname "$NODE_BIN")"
export PATH="$NODE_DIR:${PATH:-/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin}"

NPM_BIN="${BWB_NPM_BIN:-$NODE_DIR/npm}"
if [[ ! -x "$NPM_BIN" ]]; then
  NPM_BIN="$(command -v npm || true)"
fi
[[ -n "$NPM_BIN" && -x "$NPM_BIN" ]] || {
  echo "Refusing deployment: no executable npm was found beside Node.js." >&2
  echo "Set BWB_NPM_BIN to the app user's readable npm executable." >&2
  exit 1
}

[[ -f package-lock.json ]] || {
  echo "Refusing deployment: package-lock.json is required for reproducible installs." >&2
  exit 1
}

# Install only the locked production tree. Ignore package lifecycle scripts; run
# the one required Prisma generation step explicitly below.
"$NPM_BIN" ci --omit=dev --ignore-scripts --no-audit --no-fund

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
