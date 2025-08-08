#!/usr/bin/env bash
# Lightweight template updater: preview with dry-run and apply with backup
# Usage:
#   bash scripts/update-from-template.sh            # preview latest
#   APPLY=1 bash scripts/update-from-template.sh    # apply latest
#   APPLY=1 bash scripts/update-from-template.sh v1.2.3  # apply specific tag
# Env:
#   BLOCKS_ONLY=1  # when applying, only update template blocks in certain files (e.g., src/server.ts)

set -euo pipefail

ROOT=$(pwd)
CACHE="$ROOT/.template-cache"
LOCK="$ROOT/template.lock"

# shellcheck disable=SC1090
source "$LOCK" 2>/dev/null || true
REPO="${repo:-https://github.com/tobenot/Basic-Web-Game-Backend}"
TARGET="${1:-${version:-latest}}"

if [ ! -d "$CACHE" ]; then
  git clone --depth=1 "$REPO" "$CACHE"
fi

git -C "$CACHE" fetch --tags --depth=1 origin

if [ "$TARGET" = "latest" ]; then
  LATEST_TAG=$(git -C "$CACHE" tag --sort=-v:refname | head -n1)
  if [ -z "$LATEST_TAG" ]; then
    TARGET=$(git -C "$CACHE" rev-parse --short HEAD)
  else
    TARGET="$LATEST_TAG"
  fi
fi

echo "Using $REPO@$TARGET"

git -C "$CACHE" checkout --force "$TARGET" >/dev/null 2>&1 || true

# Preview changes
RSYNC_COMMON=(
  -av
)

INCLUDES=(
  --include='.github/***'
  --include='scripts/***'
  --include='src/framework/***'
  --include='src/server.ts'
  --include='tsconfig.json'
  --include='vercel.json'
  --include='README.md'
  --include='CONFIGURATION.md'
  --include='CORS_GUIDE.md'
  --include='CORS_SOLUTION_SUMMARY.md'
  --exclude='*'
)

if [[ "${APPLY:-0}" = "1" ]]; then
  echo "Applying updates..."
  mkdir -p .template-backup/"$TARGET"
  if [[ "${BLOCKS_ONLY:-0}" = "1" ]]; then
    echo "BLOCKS_ONLY=1 -> replacing template blocks in specific files"
    # Backup target file
    mkdir -p ".template-backup/$TARGET/src"
    cp -a src/server.ts ".template-backup/$TARGET/src/server.ts" || true
    node scripts/apply-template-blocks.js "$CACHE/src/server.ts" "src/server.ts"
    printf "repo=%s\nversion=%s\n" "$REPO" "$TARGET" > "$LOCK"
    echo "Applied block updates. Backup at .template-backup/$TARGET"    
  else
    rsync "${RSYNC_COMMON[@]}" \
      --delete \
      --backup --backup-dir=".template-backup/$TARGET" \
      "${INCLUDES[@]}" \
      "$CACHE"/ "$ROOT"/
    printf "repo=%s\nversion=%s\n" "$REPO" "$TARGET" > "$LOCK"
    echo "Applied $TARGET. Backup stored in .template-backup/$TARGET"
  fi
else
  echo "Previewing changes (no files will be modified). Set APPLY=1 to apply."
  rsync -avnc --delete \
    "${INCLUDES[@]}" \
    "$CACHE"/ "$ROOT"/
fi