---
name: stripe-setup
description: "Auditar e configurar o billing Stripe do 10xVagas sem misturar Customers, checkouts, webhooks ou meter events com 10xDev e 10xMkt na conta compartilhada."
---

# Stripe Setup — 10xVagas

Use esta skill para auditar ou alterar checkout, créditos, Customers, webhooks e meters.
A conta Stripe é compartilhada por três produtos; leia o contrato de isolamento antes de
qualquer write.

## Contrato de namespace

| Produto | namespace obrigatório |
|---|---|
| 10xDev | `10xdev` |
| 10xMkt | `10xmkt` |
| 10xVagas | `10xvagas` |

No 10xVagas:

- meter events começam com `10xvagas_`;
- Customer e Checkout recebem **os dois** marcadores: `product=10xvagas` e
  `platform=10xvagas`;
- o webhook aceita somente metadata com ambos os marcadores corretos (fail closed);
- Customer não é reaproveitado por e-mail entre produtos;
- lookup keys de Price começam com `10xvagas_`;
- eventos de sistema da Stripe, como `checkout.session.completed`, não podem ser
  renomeados. O isolamento deles é por metadata, não por prefixo.

Nunca use apenas `product` num projeto e apenas `platform` no outro. Essa assimetria faz
cada webhook aceitar silenciosamente o checkout irmão quando o seu campo estiver ausente.

## Eventos esperados

| event_name | dimensões |
|---|---|
| `10xvagas_tokens` | `model`, `token_type` |
| `10xvagas_profile_extracted` | — |
| `10xvagas_job_match_judged` | — |
| `10xvagas_cv_adapted` | — |
| `10xvagas_form_answer_generated` | — |

O backend Node emite por `backend/src/services/stripeService.ts`. O engine Python usa
`engine/billing/stripe_meter.py`, sem SDK externo, e rejeita nomes fora dessa allowlist.

## Recursos de créditos

- Produto: `10xVagas - Créditos de IA`
- Lookup keys: `10xvagas_credits_brl_10`, `10xvagas_credits_brl_25`,
  `10xvagas_credits_brl_50`, `10xvagas_credits_brl_100`
- Valores: R$10, R$25, R$50 e R$100
- Modelo: compra avulsa; sem subscription e sem renovação automática
- Saldo: Customer Balance; crédito é uma balance transaction negativa

## Variáveis

```dotenv
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CREDITS_PACK_LOOKUP_KEYS=10xvagas_credits_brl_10,10xvagas_credits_brl_25,10xvagas_credits_brl_50,10xvagas_credits_brl_100
FRONTEND_URL=http://localhost:3000
```

Nunca imprima `STRIPE_SECRET_KEY` ou `whsec_...`.

## Ordem segura

1. Confirme test/live e a conta.
2. Faça snapshot read-only de products, prices, webhooks e meters.
3. Valide que não há duplicidade ativa por `event_name`.
4. Execute writes apenas de forma aditiva e idempotente.
5. Rode os testes de namespace.
6. Só então configure o webhook do ambiente já implantado.

O webhook live não deve ser criado antes do endpoint existir em produção, pois isso gera
entregas falhas. Nunca desative recursos legados durante a migração de namespace.

## Auditoria

```bash
./scripts/stripe-api.sh GET '/v1/products?limit=100' \
  | jq '.data[] | select(.metadata.product=="10xvagas") | {id,name,livemode}'

./scripts/stripe-api.sh GET '/v1/prices?limit=100' \
  | jq '.data[] | select(.lookup_key | startswith("10xvagas_")) | {id,lookup_key,unit_amount,currency,active}'

./scripts/stripe-api.sh GET '/v1/billing/meters?limit=100' \
  | jq '.data[] | select(.event_name | startswith("10xvagas_")) | {id,event_name,status,dimension_payload_keys}'

./scripts/stripe-api.sh GET '/v1/webhook_endpoints?limit=100' \
  | jq '.data[] | {id,url,status,enabled_events}'
```

## Setup idempotente dos meters

Modo test por padrão:

```bash
./scripts/stripe-setup-meters.sh
```

Live exige confirmação explícita no comando e uma chave live carregada:

```bash
STRIPE_SECRET_KEY=... ./scripts/stripe-setup-meters.sh --live
```

O script aborta se encontrar mais de um meter ativo para o mesmo nome. Não use `head -1`,
`limit(1)` nem ordenação para esconder colisão.

## Webhook

Endpoint do 10xVagas: `POST /billing/webhook` (sem prefixo `/api`). Evento mínimo:

- `checkout.session.completed`

O raw body é montado antes de `express.json()`. Toda resposta continua no envelope
`{ success: true, data }` / `{ success: false, error }`.

## Gateway e tokens

O Stripe LLM Gateway emite automaticamente o evento legado compartilhado
`token-billing-tokens` e não permite escolher um prefixo por produto. Para observabilidade
isolada, o código do produto deve emitir manualmente `10xvagas_tokens` a partir do usage
retornado. O evento automático legado pode continuar existindo durante a migração, mas não
deve dirigir o rate card novo do produto.

Evite cobrança dupla: hoje o custo financeiro é aplicado explicitamente no Customer
Balance; meter é auditoria/observabilidade. Se no futuro a cobrança migrar para invoices por
meter, retire uma das emissões antes de ativar rates faturáveis.

## Banco

O domínio usa `public.users.stripe_customer_id`. DDL pela Supabase Management API ou SQL
Editor, nunca por arquivo de migration:

```sql
alter table public.users add column if not exists stripe_customer_id text;
create unique index if not exists users_stripe_customer_id_key
  on public.users (stripe_customer_id)
  where stripe_customer_id is not null;
```

## Checklist

- [ ] Chave e `livemode` corretos.
- [ ] Um único meter ativo por `event_name` esperado.
- [ ] `10xvagas_tokens` com `model` e `token_type`.
- [ ] Product/Prices com namespace `10xvagas`.
- [ ] Customer e Checkout com `product` e `platform`.
- [ ] Webhook fail closed e assinatura validada sobre raw body.
- [ ] Checkout repetido não credita duas vezes (idempotency key pelo PaymentIntent).
- [ ] Node, frontend e engine com testes focados verdes.
- [ ] Nenhum segredo ou `whsec` em commit/log.
