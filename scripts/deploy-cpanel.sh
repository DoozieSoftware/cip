#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────
# deploy-cpanel.sh — Package the CIP backend + frontend for cPanel
# ─────────────────────────────────────────────────────────────────
#
# This script runs on your LOCAL machine (macOS/Linux). It:
#   1. Builds the React frontend (Vite → dist/)
#   2. Installs backend Composer dependencies (no-dev, optimized)
#   3. Bundles everything into a single tarball ready to upload
#
# Usage:
#   ./scripts/deploy-cpanel.sh
#
# Output:
#   deploy/cip-cpanel.tar.gz  — upload this via cPanel File Manager
#                                or extract on the server via SSH
#
# After extraction on the server, follow docs/DEPLOY_CPANEL.md
# ─────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOY_DIR="$PROJECT_ROOT/deploy"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
OUTPUT_TAR="$DEPLOY_DIR/cip-cpanel.tar.gz"

echo "========================================"
echo "  CIP cPanel Deployment Packager"
echo "========================================"
echo ""

# ─── Step 1: Build frontend ────────────────────────────────────
echo "[1/4] Building React frontend (Vite)..."
cd "$FRONTEND_DIR"
npm install --silent
npm run build
echo "      ✓ Frontend built → frontend/dist/"
echo ""

# ─── Step 2: Install backend dependencies (production) ─────────
echo "[2/4] Installing backend Composer dependencies (no-dev, optimized)..."
cd "$BACKEND_DIR"
composer install --no-dev --optimize-autoloader --no-interaction 2>/dev/null || {
    echo "      ⚠ composer install failed. Trying with --ignore-platform-reqs..."
    composer install --no-dev --optimize-autoloader --no-interaction --ignore-platform-reqs
}
echo "      ✓ Backend dependencies installed"
echo ""

# ─── Step 3: Prepare staging directory ─────────────────────────
echo "[3/4] Staging files..."
STAGING="$DEPLOY_DIR/staging"
rm -rf "$STAGING"
mkdir -p "$STAGING/cip"
mkdir -p "$STAGING/public_html"

# Backend (exclude dev-only files, tests, .git)
rsync -a --exclude='tests/' --exclude='.git/' --exclude='node_modules/' \
    --exclude='storage/framework/cache/data/*' \
    --exclude='storage/framework/sessions/*' \
    --exclude='storage/framework/views/*' \
    --exclude='storage/logs/*' \
    --exclude='.env' \
    "$BACKEND_DIR/" "$STAGING/cip/"

# Copy the cPanel env template as .env (to be edited on server)
cp "$BACKEND_DIR/.env.cpanel" "$STAGING/cip/.env"

# Frontend dist → public_html (SPA assets)
cp -r "$FRONTEND_DIR/dist/"* "$STAGING/public_html/"
cp "$FRONTEND_DIR/dist/index.html" "$STAGING/public_html/index.html" 2>/dev/null || true

# Copy deployment .htaccess and index.php (Laravel front controller)
cp "$DEPLOY_DIR/public_html/.htaccess" "$STAGING/public_html/.htaccess"
cp "$DEPLOY_DIR/public_html/index.php" "$STAGING/public_html/index.php"

echo "      ✓ Files staged"
echo ""

# ─── Step 4: Create tarball ────────────────────────────────────
echo "[4/4] Creating tarball..."
cd "$STAGING"
tar czf "$OUTPUT_TAR" cip/ public_html/
cd "$PROJECT_ROOT"

rm -rf "$STAGING"

TAR_SIZE=$(du -h "$OUTPUT_TAR" | cut -f1)
echo "      ✓ Created $OUTPUT_TAR ($TAR_SIZE)"
echo ""
echo "========================================"
echo "  Packaging complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Upload deploy/cip-cpanel.tar.gz to your cPanel"
echo "     home directory (/home/USERNAME/) via File Manager or SCP"
echo "  2. Extract: tar xzf cip-cpanel.tar.gz"
echo "  3. SSH in and follow docs/DEPLOY_CPANEL.md"
echo ""
