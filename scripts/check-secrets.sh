#!/usr/bin/env bash
# Fails CI if any sensitive env value appears verbatim inside .next/static chunks.
# Patterns are matched as literal strings (grep -F) to avoid regex false positives.
set -euo pipefail

STATIC_DIR=".next/static"

if [ ! -d "$STATIC_DIR" ]; then
  echo "::error::$STATIC_DIR not found — run 'pnpm build' first"
  exit 1
fi

PATTERNS=(
  CRON_SECRET
  METRICS_SECRET
  GATUS_API_TOKEN
  DATABASE_URL
  UPSTASH_REDIS_REST_TOKEN
  UPSTASH_REDIS_REST_URL
)

FOUND=0
for pattern in "${PATTERNS[@]}"; do
  matches=$(grep -rF "$pattern" "$STATIC_DIR" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    echo "::error::Secret pattern '$pattern' found in $STATIC_DIR:"
    echo "$matches" | head -5
    FOUND=1
  fi
done

if [ "$FOUND" -eq 1 ]; then
  echo "::error::Secret leak detected — check which env var is exposed and ensure it is server-only (no NEXT_PUBLIC_ prefix, no import from client components)."
  exit 1
fi

echo "No secret patterns found in $STATIC_DIR — OK"
