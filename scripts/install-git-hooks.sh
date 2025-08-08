#!/usr/bin/env bash
set -euo pipefail

mkdir -p .git/hooks
cp -f scripts/git-hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

echo "Installed non-blocking pre-commit hook."