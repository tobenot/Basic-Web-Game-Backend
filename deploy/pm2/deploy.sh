#!/usr/bin/env bash
set -euo pipefail

APP="bwb"                               # must match setup.sh and ecosystem name
APP_USER="$APP"
APP_GROUP="$APP"
BASE="/opt/$APP"
RELEASES="$BASE/releases"
CURRENT="$BASE/current"
LOG_DIR="/var/log/$APP"
ETC_DIR="/etc/$APP"
ECOSYSTEM="ecosystem.config.js"
RETAIN=5
TIMEOUT=60
HEALTH_PATH="/health"

PKG=${1:?Usage: sudo deploy/pm2/deploy.sh /tmp/${APP}-<version>.tar.gz}
[[ -f "$PKG" ]] || { echo "Package not found: $PKG"; exit 1; }

mkdir -p "$RELEASES"

# Extract (package root must be <app>-<version>/)
tar -xzf "$PKG" -C "$RELEASES"
NEW_DIR=$(tar -tzf "$PKG" | head -1 | cut -f1 -d"/")
NEW_PATH="$RELEASES/$NEW_DIR"
[[ -d "$NEW_PATH" ]] || { echo "Bad package structure"; exit 1; }

# Ensure ownership and executables
chown -R "$APP_USER:$APP_GROUP" "$NEW_PATH"
chmod +x "$NEW_PATH"/bin/* 2>/dev/null || true
chmod +x "$NEW_PATH"/deploy/*.sh 2>/dev/null || true

PREV_PATH=$(readlink -f "$CURRENT" || true)

# Pre-deploy hook: install deps and optional migration (runs as app user)
if [[ -x "$NEW_PATH/deploy/pre_deploy.sh" ]]; then
  su - "$APP_USER" -c "cd '$NEW_PATH' && bash deploy/pre_deploy.sh"
fi

# Atomic switch
ln -sfn "$NEW_PATH" "$CURRENT"

# PM2 start or reload (zero-downtime in cluster mode)
if [[ -f "$CURRENT/$ECOSYSTEM" ]]; then
  su - "$APP_USER" -c "cd '$CURRENT' && pm2 startOrReload $ECOSYSTEM --env production"
  su - "$APP_USER" -c "pm2 save"
else
  echo "Ecosystem file not found: $CURRENT/$ECOSYSTEM" >&2
  exit 1
fi

# Derive port from env, default 3000
PORT=3000
if [[ -f "$ETC_DIR/$APP.env" ]]; then
  p=$(grep -E '^PORT=' "$ETC_DIR/$APP.env" | tail -n1 | cut -d= -f2- || true)
  if [[ -n "${p:-}" ]]; then PORT=$p; fi
fi

# Health check with retry
echo -n "Health checking http://127.0.0.1:${PORT}${HEALTH_PATH}"
deadline=$((SECONDS+TIMEOUT))
ok=0
while (( SECONDS < deadline )); do
  if curl -fsS "http://127.0.0.1:${PORT}${HEALTH_PATH}" >/dev/null; then ok=1; break; fi
  echo -n "."
  sleep 2
done
echo

if (( ok == 0 )); then
  echo "Health check failed, rolling back..."
  if [[ -n "${PREV_PATH:-}" && -d "$PREV_PATH" ]]; then
    ln -sfn "$PREV_PATH" "$CURRENT"
    su - "$APP_USER" -c "cd '$CURRENT' && pm2 startOrReload $ECOSYSTEM --env production" || true
    su - "$APP_USER" -c "pm2 save" || true
  fi
  exit 1
fi

# Cleanup old releases
ls -1dt "$RELEASES"/* | tail -n +$((RETAIN+1)) | xargs -r rm -rf --

echo "Deployed: $NEW_DIR"