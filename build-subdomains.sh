#!/usr/bin/env bash
#
# build-subdomains.sh
# ---------------------------------------------------------------------------
# Builds the two Pointify front-ends and the shared API proxy so each app can
# be served from its own subdomain on your own server:
#
#   admin.pointifypos.com    -> artifacts/admin-panel/dist/public   (static)
#   partner.pointifypos.com  -> artifacts/partner-portal/dist/public (static)
#   /api on BOTH subdomains   -> the API proxy (Node, listens on $API_PORT)
#
# Each front-end is built rooted at "/" (BASE_PATH=/) so it lives at the root
# of its subdomain. Both apps call the API using the relative path "/api", so
# each subdomain's web server must reverse-proxy "/api" to the API proxy.
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")"

# Port baked in only to satisfy the Vite config at build time (not used by the
# static output). The API proxy listens on API_PORT at runtime.
BUILD_PORT="${BUILD_PORT:-3000}"
API_PORT="${API_PORT:-8080}"

echo "==> Installing dependencies"
pnpm install --frozen-lockfile

echo "==> Building admin panel (rooted at /)"
PORT="$BUILD_PORT" BASE_PATH="/" NODE_ENV="production" \
  pnpm --filter @workspace/admin-panel run build

echo "==> Building partner portal (rooted at /)"
PORT="$BUILD_PORT" BASE_PATH="/" NODE_ENV="production" \
  pnpm --filter @workspace/partner-portal run build

echo "==> Building API proxy"
NODE_ENV="production" \
  pnpm --filter @workspace/api-server run build

cat <<EOF

==> Build complete.

Static front-ends:
  admin   -> $(pwd)/artifacts/admin-panel/dist/public
  partner -> $(pwd)/artifacts/partner-portal/dist/public

API proxy (run as a long-lived process):
  PORT=$API_PORT NODE_ENV=production node \\
    $(pwd)/artifacts/api-server/dist/index.mjs
  # Optional: set POS_API_BASE_URL to override the upstream POS API base URL.

Web-server wiring (per subdomain):
  - Serve the matching dist/public folder as the site root.
  - SPA fallback: route unknown paths to /index.html.
  - Reverse-proxy "/api" to http://127.0.0.1:$API_PORT (the API proxy above).

Example nginx for admin.pointifypos.com (mirror for partner.pointifypos.com):
  server {
    server_name admin.pointifypos.com;
    root $(pwd)/artifacts/admin-panel/dist/public;
    location /api { proxy_pass http://127.0.0.1:$API_PORT; }
    location / { try_files \$uri /index.html; }
  }
EOF
