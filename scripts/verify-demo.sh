#!/usr/bin/env bash
# scripts/verify-demo.sh — one-shot check that the demo is wired up.
#
# What it verifies:
#   1. The Laravel backend boots and serves /api/v1/health
#   2. The 4 demo accounts exist
#   3. The default report types are seeded
#   4. The frontend builds clean (TypeScript + Vite)
#   5. The Pest suite passes (Users + Departments + Security + Reports)
#
# Run from the project root:
#   bash scripts/verify-demo.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> 1. Backend health check"
curl -sf http://localhost:8000/api/v1/health | grep -q '"success":true' && echo "    OK" || {
  echo "    FAIL: backend not reachable on :8000"
  echo "    Hint: cd backend && php artisan serve --port=8000"
  exit 1
}

echo "==> 2. Demo accounts"
cd backend
for mobile in +919999900001 +919999900002 +919999900003 +919999900004; do
  count=$(./vendor/bin/pest --filter "demo" 2>/dev/null | head -1 || true)
  if php artisan tinker --execute="dump(\App\Modules\Users\Models\User::query()->where('mobile','$mobile')->exists());" 2>/dev/null | grep -q "true"; then
    echo "    OK: $mobile"
  else
    echo "    FAIL: $mobile missing — run: php artisan db:seed --class=DemoUsersSeeder"
    exit 1
  fi
done

echo "==> 3. Default report types"
n=$(php artisan tinker --execute="dump(\App\Modules\Reports\Models\ReportType::query()->count());" 2>/dev/null | tr -d ' ' | tail -1)
if [ "${n:-0}" -ge 10 ]; then
  echo "    OK: $n report types"
else
  echo "    FAIL: only $n report types — run: php artisan db:seed --class=ReportTypesSeeder"
  exit 1
fi

echo "==> 4. Frontend build"
cd "$ROOT/frontend"
npx tsc --noEmit
echo "    OK: TypeScript clean"
npx vite build > /tmp/vite-build.log 2>&1 && echo "    OK: vite build" || {
  echo "    FAIL: vite build failed — see /tmp/vite-build.log"
  exit 1
}

echo "==> 5. Pest sweep (Users + Departments + Security + Reports)"
cd "$ROOT/backend"
./vendor/bin/pest tests/Feature/Users/ tests/Feature/Departments/ tests/Feature/Security/ tests/Feature/Reports/ 2>&1 | tail -3

echo
echo "All checks passed. The demo is ready."
echo "Next:"
echo "  - Open http://localhost:5173 (frontend dev server)"
echo "  - Sign in as +919999900001 (Citizen) and follow DEMO.md"
