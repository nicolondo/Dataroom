#!/usr/bin/env bash
# Runs from a systemd timer: if origin/master moved, re-run the installer from
# the freshly fetched checkout. Logs go to `journalctl -u dataroom-update`.
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/dataroom}"
BRANCH="${BRANCH:-master}"
cd "$APP_DIR"
git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true
git fetch -q --depth 1 origin "$BRANCH"
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"
if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi
echo "Update available: $LOCAL -> $REMOTE"
git reset -q --hard "origin/$BRANCH"
exec bash "$APP_DIR/deploy/install.sh"
