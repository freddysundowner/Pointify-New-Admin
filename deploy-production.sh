#!/usr/bin/env bash
#
# deploy-production.sh
# ---------------------------------------------------------------------------
# Run this ON your production server (Ubuntu/Debian) to deploy the Pointify
# admin panel and partner portal. Both front-ends AND the API proxy are served
# by a SINGLE Node process ("pointify-api") managed by PM2, with nginx in front
# terminating SSL and proxying each subdomain to that process:
#
#   admin.pointifypos.com    -> pointify-api (serves the admin SPA)
#   partner.pointifypos.com  -> pointify-api (serves the partner SPA)
#   /api on BOTH subdomains   -> pointify-api (proxies upstream api.pointifypos.com)
#
# The one process picks which SPA to serve by request hostname (admin.* vs
# partner.*) and proxies every /api request upstream. nginx forwards the
# original Host header so that hostname routing works.
#
# The script is idempotent and self-checking. On each run it will:
#   1. Verify prerequisites (node, pnpm, pm2, nginx, certbot) and install the
#      system packages it can (nginx, certbot, pm2) when missing.
#   2. Build both front-ends (rooted at "/") and the API proxy.
#   3. Persist API runtime config (SESSION_SECRET, port) in a root-only env file.
#   4. Start/reload the pointify-api process under PM2 and save the PM2 list.
#   5. Create each subdomain's nginx server block IF it does not already exist
#      (existing configs are left untouched so certbot's SSL edits survive).
#   6. Obtain/enable SSL via certbot IF a certificate does not already exist.
#   7. Test and reload nginx.
#
# Usage:
#   sudo LE_EMAIL=you@example.com ./deploy-production.sh
#
# Configurable via environment variables (defaults shown):
#   ADMIN_DOMAIN=admin.pointifypos.com
#   PARTNER_DOMAIN=partner.pointifypos.com
#   API_PORT=8080                (reused from the env file on re-runs)
#   POS_API_BASE_URL=            (optional upstream override; not a secret)
#   SESSION_SECRET=              (auto-generated & persisted if not provided)
#   NODE_BIN=                    (path to a Node 20+ binary to use for build/run)
#   LE_EMAIL=                    (required to obtain SSL certificates)
#   FORCE_NGINX=0                (set to 1 to overwrite existing nginx configs)
#   SKIP_SSL=0                   (set to 1 to skip the certbot/SSL step)
#   SKIP_BUILD=0                 (set to 1 to reuse an existing build)
# ---------------------------------------------------------------------------
set -euo pipefail

ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.pointifypos.com}"
PARTNER_DOMAIN="${PARTNER_DOMAIN:-partner.pointifypos.com}"
# Remember whether the operator pinned a port explicitly; if not, we prefer the
# port already persisted in the env file so re-runs keep the same nginx wiring.
API_PORT_SET="${API_PORT:+1}"
API_PORT="${API_PORT:-8080}"
POS_API_BASE_URL="${POS_API_BASE_URL:-}"
SESSION_SECRET="${SESSION_SECRET:-}"
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
API_ENTRY="$REPO_DIR/artifacts/api-server/dist/index.mjs"

log()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ok\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m  ! \033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

# --- Port helpers -----------------------------------------------------------
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

# Resolve API_PORT to a free port, incrementing past squatters. We delete our
# own PM2 process before calling this, so our previous port reads as free.
resolve_api_port() {
  if ! have ss && ! have lsof; then
    warn "No port probe (ss/lsof) found; using API_PORT=$API_PORT without conflict detection."
    return
  fi
  local desired="$API_PORT" max_attempts=20 attempt=0
  while [ "$attempt" -lt "$max_attempts" ]; do
    port_in_use "$API_PORT" || break
    warn "Port $API_PORT is in use by another process; trying $((API_PORT + 1))."
    API_PORT=$((API_PORT + 1))
    attempt=$((attempt + 1))
  done
  [ "$attempt" -lt "$max_attempts" ] \
    || die "Could not find a free API port within $max_attempts attempts starting at $desired. Free a port or set API_PORT explicitly."
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

# NODE_BIN lets you point this deploy at a non-default Node (e.g. when the
# server's default `node` is too old for Vite but you have a newer one
# installed elsewhere): NODE_BIN=/opt/node20/bin/node bash deploy-production.sh
# Its directory is put first on PATH so the build (pnpm/vite) and the PM2
# process (via --interpreter) both use it, while the system default node stays
# untouched.
if [ -n "${NODE_BIN:-}" ]; then
  [ -x "$NODE_BIN" ] || die "NODE_BIN='$NODE_BIN' is not executable. Point it at a Node 20+ binary, e.g. /opt/node20/bin/node."
  PATH="$(dirname "$NODE_BIN"):$PATH"
  export PATH
elif ! have node; then
  die "Node.js is not installed. Install Node.js 20+ (24 recommended), e.g. via https://github.com/nodesource/distributions, then re-run. To use a non-default Node, set NODE_BIN=/path/to/node."
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || die "Node.js $NODE_MAJOR detected; need 20+ (Vite 7 requires 20.19+; 24 recommended). Tip: install a newer Node elsewhere and run with NODE_BIN=/opt/node20/bin/node to use it just for this deploy."
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

# PM2 runs the API process (matches the rest of this server's apps). Install it
# globally via npm if missing, using the resolved Node.
if ! have pm2; then
  log "Installing pm2 globally"
  npm install -g pm2 >/dev/null 2>&1 || die "Failed to install pm2. Install it manually ('npm i -g pm2') and re-run."
fi
ok "pm2 $(pm2 -v 2>/dev/null | tail -n1)"

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
[ -f "$API_ENTRY" ]              || die "API build missing ($API_ENTRY). Re-run without SKIP_BUILD=1."

# ----------------------------------------------------------------------------
# 3. API runtime config (SESSION_SECRET + port), persisted root-only
# ----------------------------------------------------------------------------
log "Preparing API runtime config ($ENV_FILE)"
mkdir -p "$ENV_DIR"

# SESSION_SECRET: explicit env var wins; otherwise reuse what's on disk;
# otherwise generate one. Rotating it would invalidate live sessions, so we
# never change it unless the operator passes one.
if [ -z "$SESSION_SECRET" ] && [ -f "$ENV_FILE" ]; then
  SESSION_SECRET="$(sed -n 's/^SESSION_SECRET=//p' "$ENV_FILE" | head -n1)"
  [ -n "$SESSION_SECRET" ] && ok "Reusing existing SESSION_SECRET"
fi
if [ -z "$SESSION_SECRET" ]; then
  SESSION_SECRET="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  log "Generated a new SESSION_SECRET"
fi

# Port: if the operator didn't pin one, reuse the port already persisted on disk
# so nginx keeps pointing at the right place across re-runs.
if [ -z "$API_PORT_SET" ] && [ -f "$ENV_FILE" ]; then
  PERSISTED_PORT="$(sed -n 's/^PORT=//p' "$ENV_FILE" | head -n1)"
  if [ -n "$PERSISTED_PORT" ]; then
    API_PORT="$PERSISTED_PORT"
    ok "Reusing persisted API_PORT=$API_PORT"
  fi
fi

# Free our own port (if the previous pointify-api is up) before resolving, so a
# re-deploy keeps the same port instead of incrementing past itself.
pm2 delete "$SERVICE_NAME" >/dev/null 2>&1 || true
log "Resolving API port (desired: $API_PORT)"
resolve_api_port

# (Re)write the env file so changed config takes effect on re-runs.
{
  printf 'SESSION_SECRET=%s\n' "$SESSION_SECRET"
  printf 'PORT=%s\n' "$API_PORT"
  printf 'NODE_ENV=production\n'
  printf 'ADMIN_DIST=%s\n' "$ADMIN_SRC"
  printf 'PARTNER_DIST=%s\n' "$PARTNER_SRC"
  if [ -n "$POS_API_BASE_URL" ]; then printf 'POS_API_BASE_URL=%s\n' "$POS_API_BASE_URL"; fi
} > "$ENV_FILE"
chmod 600 "$ENV_FILE"
chown root:root "$ENV_FILE"

# ----------------------------------------------------------------------------
# 4. Start the API process under PM2
# ----------------------------------------------------------------------------
log "Starting $SERVICE_NAME under PM2 (port $API_PORT)"
# Load the runtime config into this shell so PM2 captures it for the process.
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

pm2 start "$API_ENTRY" \
  --name "$SERVICE_NAME" \
  --interpreter "$NODE_BIN" \
  --time \
  --update-env
pm2 save >/dev/null 2>&1 || warn "pm2 save failed; the process may not survive a reboot. Run 'pm2 startup' once, then 'pm2 save'."

sleep 2
if pm2 jlist 2>/dev/null | grep -q "\"name\":\"$SERVICE_NAME\""; then
  ok "$SERVICE_NAME is registered with PM2"
  if have curl; then
    if curl -fsS -m 5 "http://127.0.0.1:$API_PORT/api/healthz" >/dev/null 2>&1; then
      ok "API health check passed (/api/healthz)"
    else
      warn "Process is up but /api/healthz did not respond OK. Inspect: pm2 logs $SERVICE_NAME --lines 50"
    fi
  fi
else
  warn "PM2 did not register $SERVICE_NAME. Inspect: pm2 logs $SERVICE_NAME --lines 50"
fi

# ----------------------------------------------------------------------------
# 5. nginx server blocks (create only if missing) — proxy ALL traffic to PM2
# ----------------------------------------------------------------------------
write_nginx() {
  local domain="$1"
  local conf="/etc/nginx/sites-available/$domain.conf"
  local link="/etc/nginx/sites-enabled/$domain.conf"

  if [ -f "$conf" ] && [ "$FORCE_NGINX" != "1" ]; then
    ok "nginx config already exists for $domain (left untouched; set FORCE_NGINX=1 to overwrite)"
    grep -q "server_name $domain" "$conf" || warn "  existing $conf has no 'server_name $domain' — it may not serve this subdomain."
    grep -q "proxy_pass" "$conf"          || warn "  existing $conf has no proxy_pass — it won't reach pointify-api. Set FORCE_NGINX=1 to regenerate."
    grep -q "127.0.0.1:$API_PORT" "$conf" || warn "  existing $conf does not proxy to 127.0.0.1:$API_PORT — it may point at a stale/dead backend (this is the usual cause of a 502). Set FORCE_NGINX=1 to regenerate."
  else
    log "Writing nginx config for $domain"
    cat > "$conf" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $domain;

    # Everything (the SPA and /api) is served by the pointify-api process. The
    # original Host header is forwarded so it can pick the right front-end.
    location / {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX
    ok "wrote $conf"
  fi

  # Disable a legacy per-domain server block (old convention: a sites-enabled
  # file named exactly "$domain" WITHOUT the .conf suffix). Leaving it enabled
  # makes nginx ignore one of the duplicate server_names and, worse, can cause
  # certbot to wire SSL into that old (dead-upstream) vhost instead of ours —
  # which surfaces as a 502 on HTTPS. The sites-available original is kept.
  local legacy_link="/etc/nginx/sites-enabled/$domain"
  if [ "$legacy_link" != "$link" ] && { [ -L "$legacy_link" ] || [ -f "$legacy_link" ]; }; then
    warn "Disabling legacy nginx site '$legacy_link' (conflicts with $domain.conf)"
    rm -f "$legacy_link"
  fi

  ln -sf "$conf" "$link"
}
write_nginx "$ADMIN_DOMAIN"
write_nginx "$PARTNER_DOMAIN"

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
echo "  Admin   : https://$ADMIN_DOMAIN"
echo "  Partner : https://$PARTNER_DOMAIN"
echo "  Process : PM2 '$SERVICE_NAME' on 127.0.0.1:$API_PORT (serves both SPAs + /api)"
echo
echo "  Useful checks:"
echo "    pm2 status"
echo "    pm2 logs $SERVICE_NAME --lines 50"
echo "    curl -I http://127.0.0.1:$API_PORT/api/healthz"
echo "    curl -I -H 'Host: $ADMIN_DOMAIN' http://127.0.0.1:$API_PORT/"
