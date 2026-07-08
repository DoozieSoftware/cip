#!/usr/bin/env bash
# ====================================================================
# Civic Intelligence Platform — local development starter
#
# Starts the Laravel backend (php8.4 artisan serve) and the Vite
# frontend dev server. Assumes MySQL, Redis, and MinIO are already
# running locally (or via other projects).
#
# Usage:
#   ./start.sh              # start backend + frontend
#   ./start.sh --setup      # first-time: create DB, migrate, seed
#
# Requirements:
#   - PHP 8.4 (php8.4 binary)
#   - Node >= 18
#   - MySQL running on 127.0.0.1:3306
#   - Redis running on 127.0.0.1:6379
# ====================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

SETUP=false
DEV_HTTP=false
for arg in "$@"; do
  case "$arg" in
    --setup) SETUP=true ;;
    --http) DEV_HTTP=true ;;
    -h|--help)
      echo "Usage: $0 [--setup] [--http]"
      echo "  --setup   First-time setup: create DB, run migrations + seed"
      echo "  --http    Serve the frontend over plain HTTP on localhost instead"
      echo "            of HTTPS with the self-signed .devssl cert. Use this to"
      echo "            test service workers / push notifications: browsers"
      echo "            treat http://localhost as a secure context, but do NOT"
      echo "            trust a clicked-through self-signed cert for service"
      echo "            worker script fetches, so push subscriptions silently"
      echo "            fail with 'subscription_failed' over https://<lan-ip>."
      exit 0
      ;;
  esac
done

# ── colours ────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[cip]${NC} $*"; }
warn()  { echo -e "${YELLOW}[cip]${NC} $*"; }
fail()  { echo -e "${RED}[cip]${NC} $*"; exit 1; }

# ── Resolve PHP binary ────────────────────────────────────────────
if command -v php8.4 >/dev/null 2>&1; then
  PHP=php8.4
elif command -v php >/dev/null 2>&1; then
  PHP_VERSION=$(php -r 'echo PHP_MAJOR_VERSION*100+PHP_MINOR_VERSION;')
  if [ "$PHP_VERSION" -ge 804 ]; then
    PHP=php
  else
    fail "php found but it's $(php -v | head -1). Need PHP >= 8.4."
  fi
else
  fail "php not found. Install PHP 8.4."
fi

# ── 1. Prerequisites ──────────────────────────────────────────────
info "Checking prerequisites..."
command -v node >/dev/null 2>&1 || fail "node is required."
command -v curl >/dev/null 2>&1 || fail "curl is required."
info "PHP $($PHP --version | head -1 | awk '{print $2}') | Node $(node -v)"

# ── 2. Check local services ───────────────────────────────────────
info "Checking local services..."

# MySQL
if mysqladmin ping -h 127.0.0.1 -uroot -p"root" --silent 2>/dev/null; then
  info "MySQL: OK"
else
  fail "MySQL not reachable on 127.0.0.1:3306. Start it first."
fi

# Redis
if redis-cli ping 2>/dev/null | grep -q PONG; then
  info "Redis: OK"
else
  fail "Redis not reachable on 127.0.0.1:6379. Start it first."
fi

# ── 3. Backend setup ───────────────────────────────────────────────
cd "$ROOT/backend"

# Ensure .env exists
if [ ! -f .env ]; then
  cp .env.example .env
  info "Created .env from .env.example"
fi

# Ensure hosts point to localhost (not Docker hostnames)
if grep -q "DB_HOST=mysql$" .env; then
  sed -i 's/^DB_HOST=mysql$/DB_HOST=127.0.0.1/' .env
fi
if grep -q "REDIS_HOST=redis$" .env; then
  sed -i 's/^REDIS_HOST=redis$/REDIS_HOST=127.0.0.1/' .env
fi

# First-time setup: create DB + migrate + seed
if [ "$SETUP" = true ]; then
  info "Setting up database..."
  mysql -u root -p"root" -e "
    CREATE DATABASE IF NOT EXISTS cip CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS 'cip'@'localhost' IDENTIFIED BY 'cip';
    GRANT ALL PRIVILEGES ON cip.* TO 'cip'@'localhost';
    FLUSH PRIVILEGES;
  " 2>/dev/null
  info "Database 'cip' ready"

  $PHP artisan key:generate --force 2>&1
  $PHP artisan migrate --force 2>&1
  $PHP artisan db:seed --force 2>&1
  $PHP artisan storage:link 2>/dev/null || true
  info "Migrations + seeds complete"
fi

cd "$ROOT/backend"
$PHP artisan config:clear >/dev/null 2>&1 || true
$PHP artisan route:clear >/dev/null 2>&1 || true
cd "$ROOT"

# ── 4. Frontend setup ──────────────────────────────────────────────
cd "$ROOT/frontend"
if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
fi
if [ ! -d node_modules ]; then
  info "Installing frontend dependencies..."
  npm install
fi
cd "$ROOT"

# ── 5. Check ports ────────────────────────────────────────────────
BACKEND_PORT=8000
FRONTEND_PORT=5173

for port in $BACKEND_PORT $FRONTEND_PORT; do
  if lsof -i :$port -sTCP:LISTEN >/dev/null 2>&1; then
    warn "Port $port is in use — killing existing process..."
    fuser -k $port/tcp 2>/dev/null || true
    sleep 1
  fi
done

# ── 6. Start servers ──────────────────────────────────────────────
info "Starting servers..."

cd "$ROOT/backend"
$PHP artisan serve --port=$BACKEND_PORT --host=0.0.0.0 > /tmp/cip-backend.log 2>&1 &
BACKEND_PID=$!
cd "$ROOT"

cd "$ROOT/frontend"
if [ "$DEV_HTTP" = true ]; then
  info "Serving frontend over plain HTTP (--http) — use http://localhost:$FRONTEND_PORT for push/service-worker testing"
  CIP_DEV_HTTP=1 npx vite --host --port $FRONTEND_PORT > /tmp/cip-frontend.log 2>&1 &
else
  npx vite --host --port $FRONTEND_PORT > /tmp/cip-frontend.log 2>&1 &
fi
FRONTEND_PID=$!
cd "$ROOT"

# ── 7. Health check ───────────────────────────────────────────────
sleep 3
if curl -sf http://localhost:$BACKEND_PORT/api/v1/health >/dev/null 2>&1; then
  info "Backend health: OK"
else
  warn "Backend health check failed — check /tmp/cip-backend.log"
  cat /tmp/cip-backend.log | tail -5
fi

# ── 8. Summary ─────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  CIP is running!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
FRONTEND_SCHEME="https"
if [ "$DEV_HTTP" = true ] || [ ! -f "$ROOT/frontend/.devssl/key.pem" ] || [ ! -f "$ROOT/frontend/.devssl/cert.pem" ]; then
  FRONTEND_SCHEME="http"
fi
echo "  Backend API:   http://localhost:$BACKEND_PORT/api/v1"
echo "  Frontend:      $FRONTEND_SCHEME://localhost:$FRONTEND_PORT"
if [ "$FRONTEND_SCHEME" = "https" ]; then
  echo "                 (self-signed cert — service workers/push won't work here;"
  echo "                 rerun with --http for push/service-worker testing)"
fi
echo ""
echo "  Demo accounts (OTP via response):"
echo "    Citizen:     9999900001"
echo "    Moderator:   9999900002"
echo "    Department:  9999900003"
echo "    Admin:       9999900004"
echo ""
echo "  Logs:"
echo "    Backend:    tail -f /tmp/cip-backend.log"
echo "    Frontend:   tail -f /tmp/cip-frontend.log"
echo ""
echo "  Stop:  kill $BACKEND_PID $FRONTEND_PID"
echo ""

cleanup() {
  info "Shutting down..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
