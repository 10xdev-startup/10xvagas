#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-test}"
if [[ "$MODE" != "test" && "$MODE" != "--live" ]]; then
  echo "Uso: $0 [--live]" >&2
  exit 1
fi
if ! command -v stripe >/dev/null || ! command -v jq >/dev/null; then
  echo "ERRO: stripe CLI e jq sao obrigatorios" >&2
  exit 1
fi

STRIPE_ARGS=(--stripe-version 2026-03-25.dahlia)
if [[ "$MODE" == "--live" ]]; then
  if [[ "${STRIPE_SECRET_KEY:-}" != sk_live_* && "${STRIPE_SECRET_KEY:-}" != rk_live_* ]]; then
    echo "ERRO: --live exige STRIPE_SECRET_KEY live no ambiente" >&2
    exit 1
  fi
  export STRIPE_API_KEY="$STRIPE_SECRET_KEY"
  STRIPE_ARGS+=(--live)
fi

METER_SNAPSHOT="$(stripe get /v1/billing/meters --limit 100 "${STRIPE_ARGS[@]}")"

ensure_meter() {
  local event_name="$1"
  local display_name="$2"
  local kind="${3:-feature}"
  local count
  count="$(printf '%s' "$METER_SNAPSHOT" | jq --arg name "$event_name" '[.data[] | select(.status=="active" and .event_name==$name)] | length')"
  if [[ "$count" -gt 1 ]]; then
    echo "ERRO: $event_name possui $count meters ativos; resolva a ambiguidade manualmente" >&2
    exit 1
  fi
  if [[ "$count" -eq 1 ]]; then
    printf 'exists %s\n' "$event_name"
    return
  fi

  local create_args=(
    billing meters create --confirm
    --default-aggregation.formula sum
    --display-name "$display_name"
    --event-name "$event_name"
    --customer-mapping.type by_id
    --customer-mapping.event-payload-key stripe_customer_id
    --value-settings.event-payload-key value
  )
  if [[ "$kind" == "tokens" ]]; then
    create_args+=(-d 'dimension_payload_keys[0]=model' -d 'dimension_payload_keys[1]=token_type')
  fi
  stripe "${create_args[@]}" "${STRIPE_ARGS[@]}" | jq -r '"created \(.event_name)"'
}

ensure_meter 10xvagas_tokens '10xVagas - Tokens de IA' tokens
ensure_meter 10xvagas_profile_extracted '10xVagas - Perfil extraido'
ensure_meter 10xvagas_job_match_judged '10xVagas - Match julgado'
ensure_meter 10xvagas_cv_adapted '10xVagas - Curriculo adaptado'
ensure_meter 10xvagas_form_answer_generated '10xVagas - Resposta de formulario'
