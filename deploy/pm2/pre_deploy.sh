#!/usr/bin/env bash
set -euo pipefail

# Compatibility wrapper only. Production deployments use systemd/pre_deploy.sh.
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
exec "$SCRIPT_DIR/../systemd/pre_deploy.sh" "$@"
