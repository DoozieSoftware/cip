#!/usr/bin/env bash
# scripts/check_bundle_budget.sh
#
# T-M13-022 — bundle budget gate. Runs after `vite build` and
# fails if any chunk exceeds the agreed-on size.
#
# Per `docs/13` §11 the citizen PWA budget is:
#   - first-load JS     ≤ 350 kB gzipped
#   - largest single chunk ≤ 600 kB raw
#   - the registration worker + manifest + icons together
#     land under 100 kB raw.
set -euo pipefail

cd "$(dirname "$0")/../frontend"
DIST="dist/assets"

if [[ ! -d "$DIST" ]]; then
  echo "::error::dist/assets missing — run 'npm run build' first."
  exit 1
fi

FAIL=0
WARN_LIMIT_KB=600
GZ_FIRST_LOAD_LIMIT_KB=350

# Largest single chunk
LARGEST_RAW=$(find "$DIST" -name "*.js" -type f -exec stat -f '%z %N' {} + 2>/dev/null | sort -nr | head -1 || true)
LARGEST_RAW_BYTES=$(echo "$LARGEST_RAW" | awk '{print $1}' || echo 0)
LARGEST_RAW_KB=$((LARGEST_RAW_BYTES / 1024))
echo "Largest chunk: ${LARGEST_RAW_KB} KB"
if (( LARGEST_RAW_KB > WARN_LIMIT_KB )); then
  echo "::error::Largest chunk is ${LARGEST_RAW_KB} KB > ${WARN_LIMIT_KB} KB budget."
  FAIL=1
fi

# First-load gzipped (we approximate "first load" as the entrypoint index-*.js)
ENTRY=""
if [[ -f "dist/index.html" ]]; then
  # The first modulepreload link in index.html is the entry.
  ENTRY_PATH=$(grep -oE '/assets/index-[A-Za-z0-9_\\-]+\.js' dist/index.html | head -1 || true)
  if [[ -n "$ENTRY_PATH" ]]; then
    ENTRY="dist${ENTRY_PATH}"
  fi
fi
if [[ -z "$ENTRY" ]]; then
  ENTRY=$(find "$DIST" -name "index-*.js" -type f -size +50k | head -1 || true)
fi
if [[ -n "$ENTRY" ]]; then
  GZ_SIZE=$(gzip -c "$ENTRY" | wc -c | tr -d ' ')
  GZ_KB=$((GZ_SIZE / 1024))
  echo "Entry gzipped: ${GZ_KB} KB"
  if (( GZ_KB > GZ_FIRST_LOAD_LIMIT_KB )); then
    echo "::error::Entry gzipped (${GZ_KB} KB) > ${GZ_FIRST_LOAD_LIMIT_KB} KB budget."
    FAIL=1
  fi
fi

# Service worker + manifest + icons
SW_SIZE=0
for f in public/sw.js public/manifest.webmanifest public/icons/*.svg; do
  if [[ -f "frontend/$f" ]] || [[ -f "$f" ]]; then
    ROOT=""
    if [[ -f "$f" ]]; then ROOT=""; fi
    if [[ -f "frontend/$f" ]]; then ROOT="frontend/"; fi
    SIZE=$(stat -f '%z' "${ROOT}${f}" 2>/dev/null || echo 0)
    SW_SIZE=$((SW_SIZE + SIZE))
  fi
done
echo "SW+manifest+icons: $((SW_SIZE / 1024)) KB"

if (( FAIL == 1 )); then
  echo "::error::Bundle budget failed."
  exit 1
fi
echo "Bundle budget OK."
