#!/usr/bin/env bash
set -euo pipefail

# Basic configurable variables
APP="bwb"                # change if needed
APP_USER="$APP"          # run pm2 under this user
APP_GROUP="$APP"
APP_HOME="/home/$APP_USER"
BASE="/opt/$APP"
LOG_DIR="/var/log/$APP"
ETC_DIR="/etc/$APP"

# Ensure root
if [[ $EUID -ne 0 ]]; then
  echo "Please run as root: sudo bash deploy/pm2/setup.sh" >&2
  exit 1
fi

# 1) Create user and directories
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$APP_USER"
fi
install -d -o "$APP_USER" -g "$APP_GROUP" "$BASE" "$BASE/releases" "$BASE/shared"
install -d -o "$APP_USER" -g "$APP_GROUP" "$LOG_DIR"
install -d -o "$APP_USER" -g "$APP_GROUP" "$ETC_DIR"

# 2) Install pm2 globally if not present
if ! command -v pm2 >/dev/null 2>&1; then
  echo "Installing pm2 globally..."
  npm i -g pm2
fi

# 3) Configure PM2 to start at boot for the app user
su - "$APP_USER" -c "pm2 ping || true" >/dev/null 2>&1 || true
pm2 startup systemd -u "$APP_USER" --hp "$APP_HOME" | sed 's/^\[PM2\].*$/&/;t;d'

# 4) Create example env file if not exists
if [[ ! -f "$ETC_DIR/$APP.env" ]]; then
  cat >"$ETC_DIR/$APP.env" <<EOF
# Runtime environment for $APP
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
# DATABASE_URL=postgresql://user:pass@host:5432/db
# JWT_SECRET=please-change-me
# MIGRATE_ON_DEPLOY=1
EOF
  chown "$APP_USER:$APP_GROUP" "$ETC_DIR/$APP.env"
  chmod 640 "$ETC_DIR/$APP.env"
fi

echo "Setup done. Next steps:"
echo "- Build and pack locally with deploy/pm2/pack.sh"
echo "- Copy the tar.gz to server, then run: sudo deploy/pm2/deploy.sh /tmp/<pkg>.tar.gz"