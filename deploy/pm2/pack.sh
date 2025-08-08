#!/usr/bin/env bash
set -euo pipefail

APP="bwb"  # change if needed; must match deploy scripts
VERSION=${1:-$(date +%Y%m%d_%H%M%S)}
ROOT_DIR="${APP}-${VERSION}"
STAGE=".release-stage/${ROOT_DIR}"
PKG="${ROOT_DIR}.tar.gz"

# 1) Build
if [[ ! -d node_modules ]]; then
  npm ci
fi
npm run build

# 2) Stage files
rm -rf .release-stage
mkdir -p "$STAGE"

# Runtime files
cp -r dist "$STAGE/"
cp -r prisma "$STAGE/" 2>/dev/null || true
cp package.json package-lock.json "$STAGE/"

# Deploy/runtime helpers
mkdir -p "$STAGE/bin" "$STAGE/deploy"
cp deploy/pm2/bin/start.sh "$STAGE/bin/start"
cp deploy/pm2/pre_deploy.sh "$STAGE/deploy/pre_deploy.sh"
cp deploy/pm2/ecosystem.config.js "$STAGE/ecosystem.config.js"

# Optional: static test page (handy for quick check)
[[ -f test.html ]] && cp test.html "$STAGE/" || true

# 3) Pack
 tar -czf "$PKG" -C ".release-stage" "$ROOT_DIR"

# 4) Cleanup stage
rm -rf .release-stage

echo "Built package: $PKG"
echo "Upload with: scp '$PKG' <user>@<server>:/tmp/"