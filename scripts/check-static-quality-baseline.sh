#!/usr/bin/env bash

# Ratchet static-quality debt: current violations may stay at or below the
# checked-in baseline, but a new violation fails CI.  Do not regenerate the
# baseline to make a failing check green; fix the violation or lower the
# corresponding limit intentionally in a reviewable change.

set -uo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
baseline_file="$repo_root/docs/static-quality-baseline.json"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

if [[ ! -f "$baseline_file" ]]; then
  echo "Missing static-quality baseline: $baseline_file" >&2
  exit 1
fi

baseline_value() {
  local key="$1"
  sed -nE "s/^[[:space:]]*\"${key}\"[[:space:]]*:[[:space:]]*([0-9]+),?[[:space:]]*$/\1/p" "$baseline_file" | head -n 1
}

compare_limit() {
  local label="$1" actual="$2" limit="$3"
  if [[ -z "$limit" || ! "$limit" =~ ^[0-9]+$ ]]; then
    echo "Invalid baseline for $label" >&2
    return 1
  fi
  if (( actual > limit )); then
    echo "$label increased: $actual (baseline $limit)" >&2
    return 1
  fi
  echo "$label: $actual (baseline $limit)"
  return 0
}

failures=0

echo "Running PHPStan baseline check..."
(cd "$repo_root/backend" && vendor/bin/phpstan analyse --no-progress) >"$work_dir/phpstan.log" 2>&1 || true
phpstan_errors="$(sed -nE 's/.*\[ERROR\][[:space:]]+Found[[:space:]]+([0-9]+)[[:space:]]+errors.*/\1/p' "$work_dir/phpstan.log" | tail -n 1)"
phpstan_errors="${phpstan_errors:-0}"
compare_limit "PHPStan errors" "$phpstan_errors" "$(baseline_value phpstan_errors)" || failures=$((failures + 1))

echo "Running ESLint baseline check..."
(cd "$repo_root/frontend" && npm exec eslint -- .) >"$work_dir/eslint.log" 2>&1 || true
eslint_errors="$(sed -nE 's/.*✖[[:space:]]+[0-9]+[[:space:]]+problems?[[:space:]]+\(([0-9]+)[[:space:]]+errors?,[[:space:]]+([0-9]+)[[:space:]]+warnings?\).*/\1/p' "$work_dir/eslint.log" | tail -n 1)"
eslint_warnings="$(sed -nE 's/.*✖[[:space:]]+[0-9]+[[:space:]]+problems?[[:space:]]+\(([0-9]+)[[:space:]]+errors?,[[:space:]]+([0-9]+)[[:space:]]+warnings?\).*/\2/p' "$work_dir/eslint.log" | tail -n 1)"
eslint_errors="${eslint_errors:-0}"
eslint_warnings="${eslint_warnings:-0}"
compare_limit "ESLint errors" "$eslint_errors" "$(baseline_value eslint_errors)" || failures=$((failures + 1))
compare_limit "ESLint warnings" "$eslint_warnings" "$(baseline_value eslint_warnings)" || failures=$((failures + 1))

echo "Running Prettier baseline check..."
(cd "$repo_root/frontend" && npx prettier --check 'src/**/*.{ts,tsx}') >"$work_dir/prettier.log" 2>&1 || true
prettier_files="$(sed -nE 's/.*Code style issues found in[[:space:]]+([0-9]+)[[:space:]]+files.*/\1/p' "$work_dir/prettier.log" | tail -n 1)"
prettier_files="${prettier_files:-0}"
compare_limit "Prettier files" "$prettier_files" "$(baseline_value prettier_files)" || failures=$((failures + 1))

echo "Running Pint baseline check..."
if (cd "$repo_root/backend" && vendor/bin/pint --test) >"$work_dir/pint.log" 2>&1; then
  pint_failures=0
else
  # Pint does not emit a stable machine-readable count.  Any failure is a
  # violation; the checked-in baseline intentionally requires a clean run.
  pint_failures=1
  sed -n '1,80p' "$work_dir/pint.log" >&2
fi
compare_limit "Pint failures" "$pint_failures" "$(baseline_value pint_failures)" || failures=$((failures + 1))

if (( failures > 0 )); then
  echo "Static-quality baseline check failed ($failures metric(s) increased)." >&2
  exit 1
fi

echo "Static-quality baseline check passed."
