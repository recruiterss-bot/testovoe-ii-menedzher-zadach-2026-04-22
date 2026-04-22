#!/usr/bin/env bash

set -euo pipefail

JEST_CONFIG_PATH="${1:-}"
if [[ -z "$JEST_CONFIG_PATH" ]]; then
  echo "Usage: run-with-prisma-dev.sh <jest-config-path>"
  exit 1
fi

BOOTSTRAP_DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/ai_task_manager}"
PRISMA_DEV_OUTPUT=$(DATABASE_URL="$BOOTSTRAP_DATABASE_URL" npx prisma dev -d)
DATABASE_URL_FROM_PRISMA=$(printf "%s\n" "$PRISMA_DEV_OUTPUT" | awk '/^postgres:\/\/|^postgresql:\/\// { print; exit }')

if [[ -z "${DATABASE_URL_FROM_PRISMA}" ]]; then
  printf '%s\n' "$PRISMA_DEV_OUTPUT"
  echo "[tests] Failed to read DATABASE_URL from prisma dev output."
  exit 1
fi

export DATABASE_URL="$DATABASE_URL_FROM_PRISMA"

npx prisma migrate deploy --config prisma.config.ts >/dev/null
npx jest --config "$JEST_CONFIG_PATH"
