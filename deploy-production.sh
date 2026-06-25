#!/usr/bin/env bash
#
# deploy-production.sh
# ---------------------------------------------------------------------------
# Run this ON your production server (Ubuntu/Debian) to deploy the two
# Pointify front-ends to their own subdomains, behind nginx, with SSL, and the
# shared API proxy running as a systemd service.
#
#   admin.pointifypos.com    -> admin panel   (static SPA)
#   partner.pointifypos.com  -> partner portal (static SPA)
#   /api on BOTH subdomains   -> the API proxy (Node, listens on 127.0.0.1:API_PORT)
#
# The script is idempotent and self-checking. On each run it will:
#   1. Verify prerequisites (node, pnpm, nginx, certbot) and install the system
#      packages it can (nginx, certbot) via apt when missing.
#   2. Build both front-ends (rooted at "/") and the API proxy.
#   3. Publish the built front-ends into each subdomain's web root.
#   4. Install/refresh the API proxy systemd service and (re)start it.
#   5. Create each subdomain's nginx server block IF it does not already exist
#      (existing configs are left untouched so certbot's SSL edits survive).
#   6. Verify the built content is actually present in each web root.
#   7. Obtain/enable SSL via certbot IF a certificate does not already exist.
#   8. Test and reload nginx.
#
# Usage:
#   sudo LE_EMAIL=you@example.com ./deploy-production.sh
#
# Configurable via environment variables (defaults shown):
#   ADMIN_DOMAIN=admin.pointifypos.com
#   PARTNER_DOMAIN=partner.pointifypos.com
#   API_PORT=8080
#   POS_API_BASE_URL=            (optional upstream override; not a secret)
#   SESSION_SECRET=              (auto-generated & persisted if not provided)
#   APP_USER=                    (user to run the API as; defaults to the
#                                 invoking sudo user, else root with a warning)
#   LE_EMAIL=                    (required to obtain SSL certificates)
#   FORCE_NGINX=0                (set to 1 to overwrite existing nginx configs)
#   SKIP_SSL=0                   (set to 1 to skip the certbot/SSL step)
#   SKIP_BUILD=0                 (set to 1 to reuse an existing build)
# ---------------------------------------------------------------------------
set -euo pipefail

ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.pointifypos.com}"
PARTNER_DOMAIN="${PARTNER_DOMAIN:-partner.pointifypos.com}"
API_PORT="${API_PORT:-8080}"
POS_API_BASE_URL="${POS_API_BASE_URL:-}"
SESSION_SECRET="${SESSION_SECRET:-}"
APP_USER="${APP_USER:-${SUDO_USER:-}}"
LE_EMAIL="${LE_EMAIL:-}"
FORCE_NGINX="${FORCE_NGINX:-0}"
SKIP_SSL="${SKIP_SSL:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"
SERVICE_NAME="pointify-api"
ENV_DIR="/etc/pointify"
ENV_FILE="$ENV_DIR/api.env"

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
ADMIN_SRC="$REPO_DIR/artifacts/admin-panel/dist/public"
PARTNER_SRC="$REPO_DIR/artifacts/partner-portal/dist/public"
ADMIN_ROOT="/var/www/$ADMIN_DOMAIN"
PARTNER_ROOT="/var/www/$PARTNER_DOMAIN"

log()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ok\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m  ! \033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

# --- Port helpers -----------------------------------------------------------
# List the PIDs currently LISTENing on a TCP port (best-effort, root-only info).
listening_pids() {
  local port="$1"
  if have ss; then
    ss -ltnpH "( sport = :$port )" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u
  elif have lsof; then
    lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | sort -u
  fi
}

# True if anything is LISTENing on the given TCP port.
port_in_use() {
  local port="$1"
  if have ss; then
    ss -ltnH "( sport = :$port )" 2>/dev/null | grep -q .
  elif have lsof; then
    lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1
  else
    return 1  # no probe available; assume free
  fi
}

# True if the port is held ONLY by our own systemd service (so a normal
# re-deploy keeps the same port — restarting the service frees and rebinds it).
port_owned_by_service() {
  local port="$1" pids p
  pids="$(listening_pids "$port")"
  [ -n "$pids" ] || return 1
  for p in $pids; do
    grep -q "$SERVICE_NAME.service" "/proc/$p/cgroup" 2>/dev/null || return 1
  done
  return 0
}

# Resolve API_PORT to a free port, incrementing past unrelated squatters. A port
# held only by the existing pointify-api service counts as available.
resolve_api_port() {
  if ! have ss && ! have lsof; then
    warn "No port probe (ss/lsof) found; using API_PORT=$API_PORT without conflict detection."
    return
  fi
  local desired="$API_PORT" max_attempts=20 attempt=0
  while [ "$attempt" -lt "$max_attempts" ]; do
    if ! port_in_use "$API_PORT"; then
      break  # free to use
    fi
    if port_owned_by_service "$API_PORT"; then
      ok "Port $API_PORT is held only by the existing $SERVICE_NAME service; reusing it (a restart rebinds it)."
      break
    fi
    warn "Port $API_PORT is in use by another process; trying $((API_PORT + 1))."
    API_PORT=$((API_PORT + 1))
    attempt=$((attempt + 1))
  done
  if [ "$attempt" -ge "$max_attempts" ]; then
    die "Could not find a free API port within $max_attempts attempts starting at $desired. Free a port or set API_PORT explicitly."
  fi
  if [ "$API_PORT" = "$desired" ]; then
    ok "Using API_PORT=$API_PORT"
  else
    log "Resolved API_PORT=$API_PORT (desired $desired was busy)"
  fi
}

# ----------------------------------------------------------------------------
# 0. Sanity
# ----------------------------------------------------------------------------
[ "$(id -u)" -eq 0 ] || die "Please run as root (use: sudo ./deploy-production.sh)."
have apt-get || die "This script targets Debian/Ubuntu (apt-get not found). Install nginx/certbot manually, then re-run with their binaries on PATH."

# ----------------------------------------------------------------------------
# 1. Prerequisites
# ----------------------------------------------------------------------------
log "Checking prerequisites"

if ! have node; then
  die "Node.js is not installed. Install Node.js 20+ (24 recommended), e.g. via https://github.com/nodesource/distributions, then re-run."
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || die "Node.js $NODE_MAJOR detected; need 20+ (24 recommended)."
ok "node $(node -v)"
NODE_BIN="$(command -v node)"

if ! have pnpm; then
  if have corepack; then
    log "Enabling pnpm via corepack"
    corepack enable >/dev/null 2>&1 || true
    corepack prepare pnpm@latest --activate >/dev/null 2>&1 || true
  fi
fi
have pnpm || die "pnpm is not installed. Install it (e.g. 'corepack enable' or 'npm i -g pnpm'), then re-run."
ok "pnpm $(pnpm -v)"

APT_UPDATED=0
apt_install() {
  if [ "$APT_UPDATED" -eq 0 ]; then
    log "Updating apt package lists"
    apt-get update -y >/dev/null
    APT_UPDATED=1
  fi
  log "Installing: $*"
  DEBIAN_FRONTEND=noninteractive apt-get install -y "$@" >/dev/null
}

have nginx || apt_install nginx
ok "nginx present"

if [ "$SKIP_SSL" != "1" ]; then
  have certbot || apt_install certbot python3-certbot-nginx
  ok "certbot present"
fi

# ----------------------------------------------------------------------------
# 2. Build
# ----------------------------------------------------------------------------
if [ "$SKIP_BUILD" = "1" ]; then
  log "Skipping build (SKIP_BUILD=1)"
else
  log "Installing dependencies"
  ( cd "$REPO_DIR" && pnpm install --frozen-lockfile )

  log "Building admin panel (rooted at /)"
  ( cd "$REPO_DIR" && PORT=3000 BASE_PATH="/" NODE_ENV=production \
      pnpm --filter @workspace/admin-panel run build )

  log "Building partner portal (rooted at /)"
  ( cd "$REPO_DIR" && PORT=3000 BASE_PATH="/" NODE_ENV=production \
      pnpm --filter @workspace/partner-portal run build )

  log "Building API proxy"
  ( cd "$REPO_DIR" && NODE_ENV=production \
      pnpm --filter @workspace/api-server run build )
fi

[ -f "$ADMIN_SRC/index.html" ]   || die "Admin build missing ($ADMIN_SRC/index.html). Re-run without SKIP_BUILD=1."
[ -f "$PARTNER_SRC/index.html" ] || die "Partner build missing ($PARTNER_SRC/index.html). Re-run without SKIP_BUILD=1."
[ -f "$REPO_DIR/artifacts/api-server/dist/index.mjs" ] || die "API build missing. Re-run without SKIP_BUILD=1."

# ----------------------------------------------------------------------------
# 3. Publish static front-ends into web roots
# ----------------------------------------------------------------------------
publish_site() {
  local src="$1" dest="$2" name="$3"
  log "Publishing $name -> $dest"
  mkdir -p "$dest"
  if have rsync; then
    rsync -a --delete "$src/" "$dest/"
  else
    rm -rf "${dest:?}/"* && cp -a "$src/." "$dest/"
  fi
  [ -f "$dest/index.html" ] || die "Publish failed: $dest/index.html not found."
  ok "$name content in place ($(find "$dest" -type f | wc -l) files)"
}
publish_site "$ADMIN_SRC"   "$ADMIN_ROOT"   "admin"
publish_site "$PARTNER_SRC" "$PARTNER_ROOT" "partner"

# ----------------------------------------------------------------------------
# 4. API proxy secrets + systemd service
# ----------------------------------------------------------------------------
# SESSION_SECRET is REQUIRED by the API at startup. Persist it in a root-only
# env file so it survives re-runs (rotating it would invalidate live sessions).
log "Preparing API runtime secrets ($ENV_FILE)"
mkdir -p "$ENV_DIR"
# Resolve SESSION_SECRET deterministically: explicit env var wins; otherwise
# reuse the value already on disk; otherwise generate one. Rotating it would
# invalidate live sessions, so we never change it unless the operator passes one.
if [ -z "$SESSION_SECRET" ] && [ -f "$ENV_FILE" ]; then
  SESSION_SECRET="$(sed -n 's/^SESSION_SECRET=//p' "$ENV_FILE" | head -n1)"
  [ -n "$SESSION_SECRET" ] && ok "Reusing existing SESSION_SECRET"
fi
if [ -z "$SESSION_SECRET" ]; then
  SESSION_SECRET="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  log "Generated a new SESSION_SECRET"
fi
# Always (re)write the env file so a changed/cleared POS_API_BASE_URL takes
# effect on re-runs. Omitting the line reverts the API to its default upstream.
{
  printf 'SESSION_SECRET=%s\n' "$SESSION_SECRET"
  if [ -n "$POS_API_BASE_URL" ]; then printf 'POS_API_BASE_URL=%s\n' "$POS_API_BASE_URL"; fi
} > "$ENV_FILE"
chmod 600 "$ENV_FILE"
chown root:root "$ENV_FILE"

# Decide which OS user runs the API (avoid root when possible).
if [ -z "$APP_USER" ] || [ "$APP_USER" = "root" ]; then
  APP_USER="root"
  warn "API service will run as root. Set APP_USER=<user> to harden (that user must be able to read $REPO_DIR)."
elif ! id "$APP_USER" >/dev/null 2>&1; then
  die "APP_USER '$APP_USER' does not exist."
fi
APP_GROUP="$(id -gn "$APP_USER" 2>/dev/null || echo "$APP_USER")"

# Pre-flight: a non-root service user must be able to execute node and read the
# built API. This catches repos cloned under /root (mode 700) before the service
# silently fails to start.
if [ "$APP_USER" != "root" ] && have sudo; then
  sudo -u "$APP_USER" test -x "$NODE_BIN" 2>/dev/null \
    || warn "User '$APP_USER' may not be able to execute node ($NODE_BIN). If node is under /root or a private dir, install it system-wide or set APP_USER=root."
  sudo -u "$APP_USER" test -r "$REPO_DIR/artifacts/api-server/dist/index.mjs" 2>/dev/null \
    || warn "User '$APP_USER' cannot read $REPO_DIR. If the repo lives under /root, move it (e.g. to the user's home or /opt) or set APP_USER=root, then re-run."
fi

# Resolve a free API port before writing the systemd unit, the health check,
# and the nginx proxy_pass — all of which reference $API_PORT downstream.
log "Resolving API port (desired: $API_PORT)"
resolve_api_port

log "Installing API proxy service ($SERVICE_NAME, user: $APP_USER)"
{
  printf '[Unit]\n'
  printf 'Description=Pointify API proxy\n'
  printf 'After=network.target\n\n'
  printf '[Service]\n'
  printf 'Type=simple\n'
  if [ "$APP_USER" != "root" ]; then
    printf 'User=%s\n' "$APP_USER"
    printf 'Group=%s\n' "$APP_GROUP"
  fi
  printf 'WorkingDirectory=%s\n' "$REPO_DIR"
  printf 'EnvironmentFile=%s\n' "$ENV_FILE"
  printf 'Environment=NODE_ENV=production\n'
  printf 'Environment=PORT=%s\n' "$API_PORT"
  printf 'ExecStart=%s --enable-source-maps %s/artifacts/api-server/dist/index.mjs\n' "$NODE_BIN" "$REPO_DIR"
  printf 'Restart=on-failure\n'
  printf 'RestartSec=3\n\n'
  printf '[Install]\n'
  printf 'WantedBy=multi-user.target\n'
} > "/etc/systemd/system/$SERVICE_NAME.service"

systemctl daemon-reload
systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true
systemctl restart "$SERVICE_NAME" || true
sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
  ok "API proxy running on 127.0.0.1:$API_PORT"
  if have curl; then
    if curl -fsS -m 5 "http://127.0.0.1:$API_PORT/api/healthz" >/dev/null 2>&1; then
      ok "API health check passed (/api/healthz)"
    else
      warn "API is up but /api/healthz did not respond OK. Inspect: journalctl -u $SERVICE_NAME -n 50"
    fi
  fi
else
  warn "API proxy failed to start. Inspect: journalctl -u $SERVICE_NAME -n 50"
fi

# ----------------------------------------------------------------------------
# 5. nginx server blocks (create only if missing)
# ----------------------------------------------------------------------------
write_nginx() {
  local domain="$1" root="$2"
  local conf="/etc/nginx/sites-available/$domain.conf"
  local link="/etc/nginx/sites-enabled/$domain.conf"

  if [ -f "$conf" ] && [ "$FORCE_NGINX" != "1" ]; then
    ok "nginx config already exists for $domain (left untouched; set FORCE_NGINX=1 to overwrite)"
    grep -q "server_name $domain" "$conf" || warn "  existing $conf has no 'server_name $domain' — it may not serve this subdomain."
    grep -q "location /api" "$conf"       || warn "  existing $conf has no '/api' proxy — API calls may 404. Set FORCE_NGINX=1 to regenerate."
    grep -q "try_files" "$conf"           || warn "  existing $conf has no SPA fallback (try_files) — deep links may 404. Set FORCE_NGINX=1 to regenerate."
  else
    log "Writing nginx config for $domain"
    cat > "$conf" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $domain;

    root $root;
    index index.html;

    # Shared API proxy
    location /api {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # SPA fallback
    location / {
        try_files \$uri /index.html;
    }
}
NGINX
    ok "wrote $conf"
  fi
  ln -sf "$conf" "$link"
}
write_nginx "$ADMIN_DOMAIN"   "$ADMIN_ROOT"
write_nginx "$PARTNER_DOMAIN" "$PARTNER_ROOT"

# Disable the stock default site if present (it can shadow the subdomains).
[ -e /etc/nginx/sites-enabled/default ] && rm -f /etc/nginx/sites-enabled/default && warn "removed default nginx site"

log "Testing nginx configuration"
nginx -t
systemctl reload nginx
ok "nginx reloaded"

# ----------------------------------------------------------------------------
# 6. SSL via certbot (only if a certificate is missing)
# ----------------------------------------------------------------------------
if [ "$SKIP_SSL" = "1" ]; then
  warn "SSL step skipped (SKIP_SSL=1)."
else
  ensure_ssl() {
    local domain="$1"
    local conf="/etc/nginx/sites-available/$domain.conf"
    if [ -d "/etc/letsencrypt/live/$domain" ]; then
      # Certificate exists. Make sure nginx is actually wired to use it (a
      # FORCE_NGINX rewrite produces an HTTP-only block that drops the 443
      # listener); if so, re-install the cert into the current config.
      if grep -q "listen 443" "$conf" 2>/dev/null; then
        ok "SSL already enabled for $domain"
      else
        log "Certificate exists but HTTPS not wired for $domain; re-installing"
        certbot install --nginx --cert-name "$domain" --non-interactive --redirect \
          && ok "SSL re-enabled for https://$domain" \
          || warn "certbot install failed for $domain; inspect: certbot certificates"
      fi
      return
    fi
    if [ -z "$LE_EMAIL" ]; then
      warn "No certificate for $domain and LE_EMAIL is unset; skipping. Re-run with: sudo LE_EMAIL=you@example.com ./deploy-production.sh"
      return
    fi
    log "Obtaining SSL certificate for $domain"
    certbot --nginx -d "$domain" --non-interactive --agree-tos -m "$LE_EMAIL" --redirect \
      && ok "SSL enabled for https://$domain" \
      || warn "certbot failed for $domain (is its DNS A/AAAA record pointing here, and ports 80/443 open?)."
  }
  ensure_ssl "$ADMIN_DOMAIN"
  ensure_ssl "$PARTNER_DOMAIN"
  systemctl reload nginx
fi

# ----------------------------------------------------------------------------
# Summary
# ----------------------------------------------------------------------------
echo
log "Done."
echo "  Admin   : https://$ADMIN_DOMAIN   (root: $ADMIN_ROOT)"
echo "  Partner : https://$PARTNER_DOMAIN (root: $PARTNER_ROOT)"
echo "  API     : 127.0.0.1:$API_PORT via systemd '$SERVICE_NAME' (proxied at /api on both)"
echo
echo "  Useful checks:"
echo "    systemctl status $SERVICE_NAME"
echo "    journalctl -u $SERVICE_NAME -f"
echo "    curl -I https://$ADMIN_DOMAIN"
echo "    curl -s https://$ADMIN_DOMAIN/api/healthz"
echo
echo "  Note: make sure DNS A/AAAA records for both subdomains point to this server"
echo "  and ports 80 + 443 are open before the SSL step can succeed."
