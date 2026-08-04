import { randomUUID } from 'node:crypto'
import Stripe from 'stripe'
import type {
  BillingFeature,
  BillingPack,
  CheckoutMetadata,
  MeterEventInput,
  TokenType,
} from '@/types/billing'
import { AppError } from '@/utils/AppError'
import {
  BILLING_NAMESPACE,
  belongsToBillingNamespace,
  namespacedMeterEventName,
} from '@/utils/billingNamespace'

const DEFAULT_PACK_LOOKUP_KEYS = [
  '10xvagas_credits_brl_10',
  '10xvagas_credits_brl_25',
  '10xvagas_credits_brl_50',
  '10xvagas_credits_brl_100',
] as const

const TOKEN_EVENT_NAME = namespacedMeterEventName('tokens')
const FEATURE_EVENT_NAMES: Record<BillingFeature, string> = {
  profile_extracted: namespacedMeterEventName('profile_extracted'),
  job_match_judged: namespacedMeterEventName('job_match_judged'),
  cv_adapted: namespacedMeterEventName('cv_adapted'),
  form_answer_generated: namespacedMeterEventName('form_answer_generated'),
}

const STRIPE_API_BASE = 'https://api.stripe.com'
const STRIPE_V2_VERSION = '2026-03-25.preview'

interface StripeRateResponse {
  unit_amount: string
  metered_item?: {
    meter?: string
    meter_segment_conditions?: Array<{ dimension: string; value: string }>
  }
}

interface TokenRate {
  model: string
  tokenType: TokenType
  unitAmountCents: number
}

let client: Stripe | null = null

function getStripe(): Stripe {
  const secretKey = process.env['STRIPE_SECRET_KEY']?.trim()
  if (!secretKey) {
    throw new AppError(503, 'Stripe nao configurada', 'STRIPE_NOT_CONFIGURED')
  }
  if (!client) client = new Stripe(secretKey)
  return client
}

function getPackLookupKeys(): string[] {
  const configured = process.env['STRIPE_CREDITS_PACK_LOOKUP_KEYS']
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return configured?.length ? configured : [...DEFAULT_PACK_LOOKUP_KEYS]
}

function customerBelongsToProduct(customer: Stripe.Customer): boolean {
  return belongsToBillingNamespace(customer.metadata)
}

async function stripeV2Get<T>(pathname: string): Promise<T> {
  const secretKey = process.env['STRIPE_SECRET_KEY']?.trim()
  if (!secretKey) throw new AppError(503, 'Stripe nao configurada', 'STRIPE_NOT_CONFIGURED')
  const response = await fetch(`${STRIPE_API_BASE}${pathname}`, {
    headers: { Authorization: `Bearer ${secretKey}`, 'Stripe-Version': STRIPE_V2_VERSION },
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Stripe GET ${pathname} respondeu ${response.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text) as T
}

async function listTokenRates(): Promise<TokenRate[]> {
  const rateCardId = process.env['STRIPE_RATE_CARD_ID']?.trim()
  if (!rateCardId) throw new Error('RATE_CARD_NOT_CONFIGURED')
  const meters = await getStripe().billing.meters.list({ limit: 100, status: 'active' })
  const matchingMeters = meters.data.filter((meter) => meter.event_name === TOKEN_EVENT_NAME)
  if (matchingMeters.length !== 1) throw new Error(`RATE_METER_AMBIGUOUS:${matchingMeters.length}`)
  const meter = matchingMeters[0]
  if (!meter) throw new Error('RATE_METER_NOT_FOUND')

  const response = await stripeV2Get<{ data?: StripeRateResponse[] }>(
    `/v2/billing/rate_cards/${rateCardId}/rates?limit=100`,
  )
  const rates: TokenRate[] = []
  for (const rate of response.data ?? []) {
    if (rate.metered_item?.meter !== meter.id) continue
    const conditions = rate.metered_item.meter_segment_conditions ?? []
    const model = conditions.find((condition) => condition.dimension === 'model')?.value
    const tokenType = conditions.find((condition) => condition.dimension === 'token_type')?.value
    if (!model || !isTokenType(tokenType)) continue
    rates.push({
      model,
      tokenType: tokenType as TokenType,
      unitAmountCents: Number(rate.unit_amount) * 100,
    })
  }
  return rates
}

const TOKEN_TYPES_SET = new Set<TokenType>(['input', 'output', 'cached'])

function isTokenType(value: string | undefined): value is TokenType {
  return value !== undefined && TOKEN_TYPES_SET.has(value as TokenType)
}

export function getTokenMeterEventName(): string {
  return TOKEN_EVENT_NAME
}

export function getFeatureMeterEventName(feature: BillingFeature): string {
  return FEATURE_EVENT_NAMES[feature]
}

export function isStripeCheckoutEnabled(): boolean {
  return process.env['STRIPE_CHECKOUT_ENABLED']?.trim().toLowerCase() === 'true'
}

export const StripeService = {
  async listPacks(): Promise<BillingPack[]> {
    const lookupKeys = getPackLookupKeys()
    const prices = await getStripe().prices.list({ active: true, lookup_keys: lookupKeys, limit: 10 })
    return prices.data
      .filter((price) => price.lookup_key && price.unit_amount !== null)
      .map((price) => ({
        amountCents: price.unit_amount ?? 0,
        currency: price.currency.toUpperCase(),
        lookupKey: price.lookup_key ?? '',
      }))
      .sort((left, right) => left.amountCents - right.amountCents)
  },

  async retrieveCustomer(customerId: string): Promise<Stripe.Customer | null> {
    try {
      const customer = await getStripe().customers.retrieve(customerId)
      if (customer.deleted || !customerBelongsToProduct(customer)) return null
      return customer
    } catch (error) {
      const stripeError = error as { code?: string; statusCode?: number }
      if (stripeError.code === 'resource_missing' || stripeError.statusCode === 404) return null
      throw error
    }
  },

  async createCustomer(userId: string, email: string): Promise<Stripe.Customer> {
    return getStripe().customers.create(
      {
        email,
        metadata: {
          app_user_id: userId,
          platform: BILLING_NAMESPACE,
          product: BILLING_NAMESPACE,
        },
      },
      { idempotencyKey: `${BILLING_NAMESPACE}_customer_${userId}` },
    )
  },

  async getBalance(customer: Stripe.Customer): Promise<{ balanceCents: number; currency: string }> {
    return {
      balanceCents: Math.max(0, -(customer.balance ?? 0)),
      currency: (customer.currency ?? 'brl').toUpperCase(),
    }
  },

  async createCheckout(params: {
    cancelUrl: string
    customerId: string
    lookupKey: string
    successUrl: string
    userId: string
  }): Promise<string> {
    const allowedLookupKeys = getPackLookupKeys()
    if (!allowedLookupKeys.includes(params.lookupKey)) {
      throw new AppError(422, 'Pacote de creditos invalido', 'INVALID_CREDITS_PACK')
    }

    const prices = await getStripe().prices.list({
      active: true,
      lookup_keys: [params.lookupKey],
      limit: 2,
    })
    if (prices.data.length !== 1) {
      throw new AppError(503, 'Pacote de creditos indisponivel', 'CREDITS_PACK_UNAVAILABLE')
    }

    const price = prices.data[0]
    if (!price) {
      throw new AppError(503, 'Pacote de creditos indisponivel', 'CREDITS_PACK_UNAVAILABLE')
    }

    const metadata: CheckoutMetadata = {
      checkoutType: 'credits_pack',
      platform: BILLING_NAMESPACE,
      product: BILLING_NAMESPACE,
      userId: params.userId,
    }
    const stripeMetadata: Record<string, string> = { ...metadata }
    const session = await getStripe().checkout.sessions.create({
      cancel_url: params.cancelUrl,
      client_reference_id: params.userId,
      customer: params.customerId,
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: stripeMetadata,
      mode: 'payment',
      payment_intent_data: { metadata: stripeMetadata },
      success_url: params.successUrl,
    })
    if (!session.url) {
      throw new AppError(503, 'Stripe nao retornou a URL do checkout', 'CHECKOUT_URL_MISSING')
    }
    return session.url
  },

  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = process.env['STRIPE_WEBHOOK_SECRET']?.trim()
    if (!secret) {
      throw new AppError(503, 'Webhook Stripe nao configurado', 'STRIPE_WEBHOOK_NOT_CONFIGURED')
    }
    return getStripe().webhooks.constructEvent(rawBody, signature, secret)
  },

  async grantCheckoutCredits(params: {
    amountCents: number
    currency: string
    customerId: string
    paymentIntentId: string
    userId: string | null
  }): Promise<void> {
    if (params.amountCents <= 0) return
    await getStripe().customers.createBalanceTransaction(
      params.customerId,
      {
        amount: -params.amountCents,
        currency: params.currency,
        description: '10xVagas - Creditos de IA',
        metadata: {
          payment_intent_id: params.paymentIntentId,
          platform: BILLING_NAMESPACE,
          product: BILLING_NAMESPACE,
          ...(params.userId ? { app_user_id: params.userId } : {}),
        },
      },
      { idempotencyKey: `${BILLING_NAMESPACE}_checkout_${params.paymentIntentId}` },
    )
  },

  async emitMeterEvent(input: MeterEventInput): Promise<string> {
    if (!input.eventName.startsWith(`${BILLING_NAMESPACE}_`)) {
      throw new AppError(422, 'Meter event fora do namespace do produto', 'INVALID_METER_NAMESPACE')
    }
    const value = Math.round(input.value)
    if (value <= 0) {
      throw new AppError(422, 'Valor do meter event deve ser positivo', 'INVALID_METER_VALUE')
    }
    const identifier = input.identifier ?? randomUUID()
    await getStripe().billing.meterEvents.create(
      {
        event_name: input.eventName,
        identifier,
        payload: {
          stripe_customer_id: input.customerId,
          value: String(value),
          ...input.dimensions,
        },
      },
      { idempotencyKey: `${BILLING_NAMESPACE}_meter_${identifier}` },
    )
    return identifier
  },

  async emitTokenUsage(params: {
    customerId: string
    identifier?: string
    model: string
    tokenType: TokenType
    tokens: number
  }): Promise<string> {
    return StripeService.emitMeterEvent({
      customerId: params.customerId,
      eventName: TOKEN_EVENT_NAME,
      value: params.tokens,
      dimensions: { model: params.model, token_type: params.tokenType },
      ...(params.identifier ? { identifier: params.identifier } : {}),
    })
  },

  async emitFeatureUsage(params: {
    customerId: string
    feature: BillingFeature
    identifier?: string
  }): Promise<string> {
    return StripeService.emitMeterEvent({
      customerId: params.customerId,
      eventName: FEATURE_EVENT_NAMES[params.feature],
      value: 1,
      ...(params.identifier ? { identifier: params.identifier } : {}),
    })
  },

  async calculateUsageCostCents(params: {
    cachedTokens: number
    inputTokens: number
    model: string
    outputTokens: number
  }): Promise<number> {
    const rates = await listTokenRates()
    const matches = (tokenType: TokenType): TokenRate[] => rates.filter(
      (rate) => rate.model === params.model && rate.tokenType === tokenType,
    )
    const inputRates = matches('input')
    const outputRates = matches('output')
    const cachedRates = matches('cached')
    if (inputRates.length !== 1 || outputRates.length !== 1 || (params.cachedTokens > 0 && cachedRates.length !== 1)) {
      throw new Error(`RATE_NOT_UNIQUE:${params.model}`)
    }
    const inputRate = inputRates[0]
    const outputRate = outputRates[0]
    const cachedRate = cachedRates[0]
    if (!inputRate || !outputRate) throw new Error(`RATE_NOT_FOUND:${params.model}`)
    const uncachedInput = Math.max(0, params.inputTokens - params.cachedTokens)
    const amount = uncachedInput * inputRate.unitAmountCents
      + params.outputTokens * outputRate.unitAmountCents
      + params.cachedTokens * (cachedRate?.unitAmountCents ?? 0)
    return Math.max(1, Math.round(amount))
  },

  async debitUsage(params: {
    amountCents: number
    customerId: string
    usageEventId: string
    userId: string
  }): Promise<string> {
    if (!Number.isInteger(params.amountCents) || params.amountCents <= 0) {
      throw new Error('INVALID_USAGE_DEBIT')
    }
    const customer = await StripeService.retrieveCustomer(params.customerId)
    if (!customer || customer.metadata['app_user_id'] !== params.userId) {
      throw new Error('CUSTOMER_NAMESPACE_MISMATCH')
    }
    const transaction = await getStripe().customers.createBalanceTransaction(
      params.customerId,
      {
        amount: params.amountCents,
        currency: 'brl',
        description: '10xVagas - Consumo de analise de perfil',
        metadata: {
          ai_usage_event_id: params.usageEventId,
          app_user_id: params.userId,
          platform: BILLING_NAMESPACE,
          product: BILLING_NAMESPACE,
        },
      },
      { idempotencyKey: `${BILLING_NAMESPACE}_usage_${params.usageEventId}` },
    )
    return transaction.id
  },
}
