#!/usr/bin/env bash
set -euo pipefail

cat >&2 <<'EOF'
PM2 packaging is retired for this application.
Use npm run pack:linux:server (or the canonical deploy/systemd workflow).
This script intentionally refuses to create a PM2-oriented release artifact.
EOF
exit 1
