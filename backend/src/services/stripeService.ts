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
    return getStripe().customers.create({
      email,
      metadata: {
        app_user_id: userId,
        platform: BILLING_NAMESPACE,
        product: BILLING_NAMESPACE,
      },
    })
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
    await getStripe().billing.meterEvents.create({
      event_name: input.eventName,
      identifier,
      payload: {
        stripe_customer_id: input.customerId,
        value: String(value),
        ...input.dimensions,
      },
      timestamp: Math.floor(Date.now() / 1_000),
    })
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
}
