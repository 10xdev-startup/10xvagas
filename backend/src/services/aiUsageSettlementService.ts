import { randomUUID } from 'node:crypto'
import { AiUsageModel } from '@/models/AiUsageModel'
import { StripeService } from '@/services/stripeService'

const SETTLEMENT_INTERVAL_MS = 5_000
const MAX_SETTLEMENT_ATTEMPTS = 5
let running = false

async function settleNext(): Promise<boolean> {
  const event = await AiUsageModel.claimPending(`backend-${process.pid}-${randomUUID().slice(0, 8)}`)
  if (!event) return false
  try {
    const costCents = await StripeService.calculateUsageCostCents({
      cachedTokens: event.cached_tokens,
      inputTokens: event.input_tokens,
      model: event.model,
      outputTokens: event.output_tokens,
    })
    for (const [tokenType, tokens] of [
      ['input', event.input_tokens],
      ['output', event.output_tokens],
      ['cached', event.cached_tokens],
    ] as const) {
      if (tokens <= 0) continue
      const identifier = event.meter_identifiers[tokenType]
      if (!identifier) throw new Error(`TOKEN_METER_IDENTIFIER_MISSING:${tokenType}`)
      await StripeService.emitTokenUsage({
        customerId: event.stripe_customer_id,
        identifier,
        model: event.model,
        tokens,
        tokenType,
      })
    }
    const transactionId = await StripeService.debitUsage({
      amountCents: costCents,
      customerId: event.stripe_customer_id,
      usageEventId: event.id,
      userId: event.user_id,
    })
    if (event.feature_meter_status === 'pending') {
      const identifier = event.meter_identifiers['feature']
      if (!identifier) throw new Error('FEATURE_METER_IDENTIFIER_MISSING')
      await StripeService.emitFeatureUsage({
        customerId: event.stripe_customer_id,
        feature: 'profile_extracted',
        identifier,
      })
    }
    await AiUsageModel.markSettled(
      event.id,
      costCents,
      transactionId,
      event.feature_meter_status === 'pending' ? 'emitted' : event.feature_meter_status,
    )
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida na liquidacao'
    const permanent = event.settlement_attempts >= MAX_SETTLEMENT_ATTEMPTS
      || message.includes('RATE_')
      || message.includes('RATE_CARD_')
    await AiUsageModel.releaseAfterFailure(event.id, message, permanent)
    console.error('[AiUsageSettlementService] liquidacao falhou', { eventId: event.id, permanent })
    return true
  }
}

async function drain(): Promise<void> {
  if (running) return
  running = true
  try {
    for (let index = 0; index < 10; index += 1) {
      if (!(await settleNext())) break
    }
  } catch (error) {
    console.error('[AiUsageSettlementService] ciclo falhou', error instanceof Error ? error.message : error)
  } finally {
    running = false
  }
}

export function startAiUsageSettlementWorker(): NodeJS.Timeout {
  void drain()
  const timer = setInterval(() => { void drain() }, SETTLEMENT_INTERVAL_MS)
  timer.unref()
  return timer
}

export const AiUsageSettlementService = { settleNext }
