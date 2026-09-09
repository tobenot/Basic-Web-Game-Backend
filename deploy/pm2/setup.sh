#!/usr/bin/env bash
set -euo pipefail

cat >&2 <<'EOF'
PM2 deployment is retired for this application.
Use deploy/systemd/basic-web-game.service and deploy/systemd/deploy.sh instead.
A production port must have exactly one supervisor; this script will not install,
configure, or start PM2.
EOF
exit 1
