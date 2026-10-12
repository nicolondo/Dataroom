#!/usr/bin/env bash
# One-shot installer / updater for the Data Room on an Ubuntu server with nginx.
#
#   curl -fsSL https://raw.githubusercontent.com/nicolondo/dataroom/master/deploy/install.sh | bash
#
# Idempotent: re-running pulls the latest code, rebuilds and restarts.
# Override defaults with environment variables, e.g. DOMAIN=example.com BASE_PATH=/vdr.
set -euo pipefail

REPO="${REPO:-https://github.com/nicolondo/dataroom.git}"
BRANCH="${BRANCH:-master}"
APP_DIR="${APP_DIR:-/opt/dataroom}"
DOMAIN="${DOMAIN:-kineticaminera.com}"
BASE_PATH="${BASE_PATH:-/dataroom}"
PORT="${PORT:-3100}"
SERVICE="dataroom"
NGINX_SNIPPET="/etc/nginx/snippets/dataroom.conf"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Run as root."; exit 1; }

log "Installing prerequisites"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates nginx openssl >/dev/null

if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  log "Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
node -v && npm -v

id -u "$SERVICE" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE"

log "Fetching code into $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"

if [ ! -f .env ]; then
  log "Writing .env"
  cat > .env <<ENV
DATABASE_URL="file:./prod.db"
SESSION_SECRET="$(openssl rand -hex 32)"
APP_URL="https://${DOMAIN}${BASE_PATH}"
BASE_PATH="${BASE_PATH}"
PORT="${PORT}"
STORAGE_DIR="${APP_DIR}/storage"
MAX_UPLOAD_MB="100"
SMTP_URL=""
EMAIL_FROM="Data Room <noreply@${DOMAIN}>"
ALLOW_SIGNUP="true"
ENV
else
  echo ".env already exists, keeping it"
fi
# Export .env so BASE_PATH/DATABASE_URL reach the build.
set -a; . ./.env; set +a

# Refuse to continue if another process (not our own service) owns the port.
systemctl stop "$SERVICE" 2>/dev/null || true
if ss -ltnH "sport = :${PORT}" 2>/dev/null | grep -q .; then
  echo "Port ${PORT} is already in use by another process:"
  ss -ltnp "sport = :${PORT}" | tail -n +2
  echo "Pick a free port: edit PORT in ${APP_DIR}/.env and re-run this script."
  exit 1
fi

log "Installing dependencies and building"
npm ci --no-audit --no-fund
npx prisma db push --skip-generate
npm run build

mkdir -p storage
chown -R "$SERVICE:$SERVICE" "$APP_DIR"

log "Installing systemd service"
sed "s#/opt/dataroom#${APP_DIR}#g; s/User=dataroom/User=${SERVICE}/; s/Group=dataroom/Group=${SERVICE}/" deploy/dataroom.service > "/etc/systemd/system/${SERVICE}.service"
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null
systemctl restart "$SERVICE"

log "Configuring nginx"
mkdir -p /etc/nginx/snippets
sed "s#/dataroom#${BASE_PATH}#g; s#127.0.0.1:3100#127.0.0.1:${PORT}#" deploy/nginx-dataroom.conf > "$NGINX_SNIPPET"

# Find the HTTPS server block(s) for the domain and add the include once.
python3 - "$DOMAIN" "$NGINX_SNIPPET" <<'PY'
import re, sys, glob, shutil, os
domain, snippet = sys.argv[1], sys.argv[2]
include = f"    include {snippet};\n"
files = [f for f in glob.glob("/etc/nginx/sites-enabled/*") + glob.glob("/etc/nginx/conf.d/*.conf") if not f.endswith(".bak-dataroom")]
backup_dir = "/root/nginx-backups"
os.makedirs(backup_dir, exist_ok=True)

def server_blocks(text):
    """Yield (start, end) of each top-level server { ... } block."""
    i = 0
    while True:
        m = re.search(r"\bserver\s*\{", text[i:])
        if not m:
            return
        start = i + m.start(); j = i + m.end(); depth = 1
        while depth and j < len(text):
            if text[j] == "{": depth += 1
            elif text[j] == "}": depth -= 1
            j += 1
        yield start, j
        i = j

contents = {}
for f in files:
    try:
        contents[f] = open(f).read()
    except OSError:
        pass
if any(include.strip() in t for t in contents.values()):
    print("nginx: snippet already included"); sys.exit(0)

# Candidates: (file, start, end, score). Prefer the domain's block, then the
# default_server block, then a lone HTTPS block.
cands = []
for f, text in contents.items():
    for start, end in server_blocks(text):
        block = text[start:end]
        if not re.search(r"listen\s+[^;]*443", block):
            continue
        names = " ".join(re.findall(r"server_name\s+([^;]+);", block)).split()
        if domain in names or f"www.{domain}" in names:
            score = 3
        elif re.search(r"listen\s+[^;]*default_server", block) or "_" in names:
            score = 2
        else:
            score = 1
        cands.append((score, f, start, end))
https_blocks = [c for c in cands]
best = max(cands, default=None)
if best is None or (best[0] == 1 and len(https_blocks) > 1):
    print(f"nginx: could not decide which HTTPS server block serves {domain}; add this line inside it manually:\n{include}")
    sys.exit(0)
score, f, start, end = best
text = contents[f]
block = text[start:end]
block = block[:-1].rstrip() + "\n" + include + "}"
shutil.copy(f, os.path.join(backup_dir, os.path.basename(f) + ".bak-dataroom"))
open(f, "w").write(text[:start] + block + text[end:])
why = {3: f"server_name {domain}", 2: "default_server", 1: "the only HTTPS server block"}[score]
print(f"nginx: added include to {f} ({why})")
PY

if nginx -t; then
  systemctl reload nginx
else
  echo "nginx config test failed; restoring backups from /root/nginx-backups"
  for b in /root/nginx-backups/*.bak-dataroom; do
    [ -f "$b" ] || continue
    name="$(basename "${b%.bak-dataroom}")"
    for dir in /etc/nginx/sites-enabled /etc/nginx/conf.d; do [ -f "$dir/$name" ] && cp "$b" "$dir/$name"; done
  done
  exit 1
fi

sleep 2
log "Checking the app"
curl -fsS -o /dev/null -w "local app: HTTP %{http_code}\n" "http://127.0.0.1:${PORT}${BASE_PATH}/login" || systemctl status "$SERVICE" --no-pager | tail -20
curl -fsS -o /dev/null -w "public url: HTTP %{http_code}\n" "https://${DOMAIN}${BASE_PATH}/login" || true

cat <<MSG

Done. Open https://${DOMAIN}${BASE_PATH}/signup to create the owner account,
then set ALLOW_SIGNUP="false" in ${APP_DIR}/.env and run: systemctl restart ${SERVICE}

Logs:   journalctl -u ${SERVICE} -f
Update: re-run this script.
MSG
