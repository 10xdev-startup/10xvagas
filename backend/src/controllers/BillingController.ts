import type { Request, Response } from 'express'
import type Stripe from 'stripe'
import { BillingModel } from '@/models/BillingModel'
import { BillingCustomerService } from '@/services/billingCustomerService'
import { isStripeCheckoutEnabled, StripeService } from '@/services/stripeService'
import type { CheckoutMetadata } from '@/types/billing'
import { AppError } from '@/utils/AppError'
import { sendOk } from '@/utils/apiResponse'
import { belongsToBillingNamespace } from '@/utils/billingNamespace'

function parseMetadata(metadata: Stripe.Metadata | null): CheckoutMetadata | null {
  if (!metadata) return null
  const { checkoutType, platform, product, userId } = metadata
  if (checkoutType !== 'credits_pack' || !platform || !product || !userId) return null
  return { checkoutType, platform, product, userId }
}

function stripeObjectId(value: string | { id: string } | null): string | null {
  return typeof value === 'string' ? value : value?.id ?? null
}

export const BillingController = {
  async status(req: Request, res: Response): Promise<void> {
    const user = req.user
    if (!user) throw new AppError(401, 'Nao autenticado', 'AUTH_REQUIRED')

    const customerId = await BillingModel.getCustomerId(user.id)
    const packsPromise = StripeService.listPacks()
    if (!customerId) {
      sendOk(res, {
        balanceCents: 0,
        checkoutEnabled: isStripeCheckoutEnabled(),
        currency: 'BRL',
        hasCustomer: false,
        packs: await packsPromise,
      })
      return
    }

    const customer = await StripeService.retrieveCustomer(customerId)
    if (!customer) {
      sendOk(res, {
        balanceCents: 0,
        checkoutEnabled: isStripeCheckoutEnabled(),
        currency: 'BRL',
        hasCustomer: false,
        packs: await packsPromise,
      })
      return
    }

    const [balance, packs] = await Promise.all([
      StripeService.getBalance(customer),
      packsPromise,
    ])
    sendOk(res, {
      ...balance,
      checkoutEnabled: isStripeCheckoutEnabled(),
      hasCustomer: true,
      packs,
    })
  },

  async checkout(req: Request, res: Response): Promise<void> {
    const user = req.user
    if (!user) throw new AppError(401, 'Nao autenticado', 'AUTH_REQUIRED')
    if (!isStripeCheckoutEnabled()) {
      throw new AppError(503, 'Compra de creditos ainda nao liberada', 'CHECKOUT_DISABLED')
    }
    const lookupKey = (req.body as { lookupKey?: unknown } | undefined)?.lookupKey
    if (typeof lookupKey !== 'string' || !lookupKey.trim()) {
      throw new AppError(422, 'lookupKey e obrigatorio', 'LOOKUP_KEY_REQUIRED')
    }

    const customer = await BillingCustomerService.getOrCreate(user.id, user.email)
    const frontendUrl = process.env['FRONTEND_URL']?.trim() || 'http://localhost:3000'
    const url = await StripeService.createCheckout({
      cancelUrl: `${frontendUrl}/billing?checkout=canceled`,
      customerId: customer.id,
      lookupKey: lookupKey.trim(),
      successUrl: `${frontendUrl}/billing?checkout=success`,
      userId: user.id,
    })
    sendOk(res, { url })
  },

  async webhook(req: Request, res: Response): Promise<void> {
    const signature = req.headers['stripe-signature']
    if (typeof signature !== 'string') {
      throw new AppError(400, 'stripe-signature ausente', 'STRIPE_SIGNATURE_REQUIRED')
    }
    if (!Buffer.isBuffer(req.body)) {
      throw new AppError(400, 'Corpo bruto do webhook ausente', 'STRIPE_RAW_BODY_REQUIRED')
    }

    let event: Stripe.Event
    try {
      event = StripeService.constructWebhookEvent(req.body, signature)
    } catch (error) {
      console.warn('[BillingController] assinatura Stripe invalida', {
        message: error instanceof Error ? error.message : 'erro desconhecido',
      })
      throw new AppError(400, 'Assinatura Stripe invalida', 'INVALID_STRIPE_SIGNATURE')
    }

    if (event.type !== 'checkout.session.completed') {
      sendOk(res, { received: true })
      return
    }

    const session = event.data.object as Stripe.Checkout.Session
    const metadata = parseMetadata(session.metadata)
    if (!belongsToBillingNamespace(metadata)) {
      console.warn('[BillingController] checkout ignorado por namespace', {
        eventId: event.id,
        platform: metadata?.platform ?? null,
        product: metadata?.product ?? null,
      })
      sendOk(res, { received: true })
      return
    }
    if (session.mode !== 'payment' || session.payment_status !== 'paid') {
      sendOk(res, { received: true })
      return
    }

    const customerId = stripeObjectId(session.customer)
    const paymentIntentId = stripeObjectId(session.payment_intent)
    if (!customerId || !paymentIntentId) {
      throw new AppError(422, 'Checkout Stripe sem identificadores financeiros', 'INVALID_CHECKOUT_SESSION')
    }

    await StripeService.grantCheckoutCredits({
      amountCents: session.amount_total ?? 0,
      currency: session.currency ?? 'brl',
      customerId,
      paymentIntentId,
      userId: metadata?.userId ?? null,
    })
    if (metadata?.userId) await BillingModel.setCustomerId(metadata.userId, customerId)
    sendOk(res, { received: true })
  },
}
