#!/usr/bin/env bash
set -euo pipefail

APP="bwb"
ETC_DIR="/etc/$APP"

# Load env if present
if [[ -f "$ETC_DIR/$APP.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ETC_DIR/$APP.env"
  set +a
fi

export NODE_ENV=${NODE_ENV:-production}
exec node dist/server.js