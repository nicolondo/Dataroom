#!/usr/bin/env bash
# Runs from a systemd timer: if origin/master moved, re-run the installer from
# the freshly fetched checkout. Logs go to `journalctl -u dataroom-update`.
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/dataroom}"
BRANCH="${BRANCH:-master}"
export HOME="${HOME:-/root}"
# The checkout is owned by the service user; allow git (running as root,
# possibly without a readable global config) to operate on it.
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0='*'
cd "$APP_DIR"
git fetch -q --depth 1 origin "$BRANCH"
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"
if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi
echo "Update available: $LOCAL -> $REMOTE"
git reset -q --hard "origin/$BRANCH"
exec bash "$APP_DIR/deploy/install.sh"
