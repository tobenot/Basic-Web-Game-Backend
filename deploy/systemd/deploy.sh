#!/usr/bin/env bash
set -euo pipefail

APP="bwb"
APP_USER="${BWB_APP_USER:-$APP}"
APP_GROUP="${BWB_APP_GROUP:-$APP}"
BASE="${BWB_BASE:-/opt/$APP}"
RELEASES="$BASE/releases"
CURRENT="$BASE/current"
ETC_DIR="${BWB_ETC_DIR:-/etc/$APP}"
ENV_FILE="$ETC_DIR/$APP.env"
UNIT="${BWB_SYSTEMD_UNIT:-basic-web-game.service}"
RETAIN=5
TIMEOUT=60
HEALTH_PATH="/health"

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/systemd/deploy.sh /tmp/${APP}-<version>.tar.gz" >&2
  exit 1
fi

PKG=${1:?Usage: sudo deploy/systemd/deploy.sh /tmp/${APP}-<version>.tar.gz}
[[ -f "$PKG" ]] || { echo "Package not found: $PKG" >&2; exit 1; }
[[ -r "$ENV_FILE" ]] || { echo "Missing runtime environment: $ENV_FILE" >&2; exit 1; }
command -v systemctl >/dev/null 2>&1 || { echo "systemctl is required" >&2; exit 1; }

PORT=3000
port_candidate=$(grep -E '^PORT=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
if [[ "${port_candidate:-}" =~ ^[0-9]+$ ]]; then PORT=$port_candidate; fi

# The systemd unit is the only allowed owner of the application port.
if command -v pm2 >/dev/null 2>&1 && id -u "$APP_USER" >/dev/null 2>&1; then
  pm2_state=$(su - "$APP_USER" -c 'pm2 jlist 2>/dev/null' || true)
  if grep -q '"status":"online"' <<< "$pm2_state"; then
    echo "Refusing systemd deployment: PM2 has an online process for this user." >&2
    echo "Choose one supervisor and remove the PM2 app before continuing." >&2
    exit 1
  fi
fi

mkdir -p "$RELEASES"
tar -xzf "$PKG" -C "$RELEASES"
NEW_DIR=$(tar -tzf "$PKG" | head -1 | cut -f1 -d'/')
NEW_PATH="$RELEASES/$NEW_DIR"
[[ -d "$NEW_PATH" ]] || { echo "Bad package structure" >&2; exit 1; }
chown -R "$APP_USER:$APP_GROUP" "$NEW_PATH"
chmod +x "$NEW_PATH"/bin/* 2>/dev/null || true
chmod +x "$NEW_PATH"/deploy/*.sh 2>/dev/null || true

PREV_PATH=$(readlink -f "$CURRENT" || true)
if [[ -x "$NEW_PATH/deploy/pre_deploy.sh" ]]; then
  su - "$APP_USER" -c "cd '$NEW_PATH' && bash deploy/pre_deploy.sh"
fi

ln -sfn "$NEW_PATH" "$CURRENT"
systemctl daemon-reload
systemctl restart "$UNIT"

health_ok=0
deadline=$((SECONDS+TIMEOUT))
while (( SECONDS < deadline )); do
  if curl -fsS "http://127.0.0.1:${PORT}${HEALTH_PATH}" >/dev/null; then
    health_ok=1
    break
  fi
  sleep 2
done

if (( health_ok == 0 )); then
  echo "Health check failed; rolling back release." >&2
  if [[ -n "${PREV_PATH:-}" && -d "$PREV_PATH" ]]; then
    ln -sfn "$PREV_PATH" "$CURRENT"
    systemctl restart "$UNIT" || true
  fi
  exit 1
fi

mapfile -t old_releases < <(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | tail -n +$((RETAIN+1)) | cut -d' ' -f2-)
for release in "${old_releases[@]}"; do
  rm -rf -- "$release"
done

echo "Deployed $NEW_DIR with $UNIT"
