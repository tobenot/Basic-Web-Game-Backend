#!/usr/bin/env bash
set -euo pipefail

cat >&2 <<'EOF'
PM2 deployment is retired for this application.
Use deploy/systemd/deploy.sh instead.
This script intentionally refuses to mutate releases or start/reload/save PM2.
EOF
exit 1
