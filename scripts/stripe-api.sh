#!/usr/bin/env bash
set -euo pipefail

METHOD="${1:-GET}"
API_PATH="${2:-}"
if [[ -z "$API_PATH" ]]; then
  echo "Uso: $0 <METHOD> <PATH>" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../backend/.env"
STRIPE_KEY="${STRIPE_SECRET_KEY:-}"

if [[ -z "$STRIPE_KEY" && -f "$ENV_FILE" ]]; then
  STRIPE_KEY="$(grep -E '^STRIPE_SECRET_KEY=' "$ENV_FILE" | head -n1 | cut -d= -f2-)"
fi
if [[ -z "$STRIPE_KEY" ]]; then
  echo "ERRO: STRIPE_SECRET_KEY nao configurada no shell nem em backend/.env" >&2
  exit 1
fi

if [[ "$API_PATH" == /v2/* ]]; then
  STRIPE_VERSION='2026-03-25.preview'
else
  STRIPE_VERSION='2026-03-25.dahlia'
fi

curl -sS -X "$METHOD" \
  -H "Authorization: Bearer $STRIPE_KEY" \
  -H "Stripe-Version: $STRIPE_VERSION" \
  "https://api.stripe.com${API_PATH}"
