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
patched = False
for f in files:
    try:
        text = open(f).read()
    except OSError:
        continue
    if include.strip() in text:
        print(f"nginx: {f} already includes the snippet"); patched = True; continue
    out, i, changed = [], 0, False
    # Walk server blocks by brace matching.
    while True:
        m = re.search(r"\bserver\s*\{", text[i:])
        if not m: out.append(text[i:]); break
        start = i + m.start(); brace = i + m.end()
        depth, j = 1, brace
        while depth and j < len(text):
            if text[j] == "{": depth += 1
            elif text[j] == "}": depth -= 1
            j += 1
        block = text[start:j]
        names = re.findall(r"server_name\s+([^;]+);", block)
        is_domain = any(domain in n.split() for n in names)
        is_ssl = re.search(r"listen\s+[^;]*443", block) is not None
        if is_domain and is_ssl:
            block = block[:-1].rstrip() + "\n" + include + "}"
            changed = True
        out.append(text[i:start] + block)
        i = j
    if changed:
        shutil.copy(f, os.path.join(backup_dir, os.path.basename(f) + ".bak-dataroom"))
        open(f, "w").write("".join(out))
        print(f"nginx: added include to {f}")
        patched = True
if not patched:
    print(f"nginx: no HTTPS server block for {domain} found; add this line inside it manually:\n{include}")
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
