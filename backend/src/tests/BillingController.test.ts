import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { Request, Response } from 'express'
import { BillingController } from '@/controllers/BillingController'
import { BillingModel } from '@/models/BillingModel'
import { CheckoutCreditGrantModel } from '@/models/CheckoutCreditGrantModel'
import { StripeService } from '@/services/stripeService'

jest.mock('@/models/BillingModel', () => ({
  BillingModel: {
    getCustomerId: jest.fn(),
    setCustomerId: jest.fn(),
  },
}))

jest.mock('@/models/CheckoutCreditGrantModel', () => ({
  CheckoutCreditGrantModel: {
    claim: jest.fn(),
    markGranted: jest.fn(),
    releaseAfterFailure: jest.fn(),
  },
}))

jest.mock('@/services/stripeService', () => ({
  StripeService: {
    constructWebhookEvent: jest.fn(),
    grantCheckoutCredits: jest.fn(),
    retrieveCustomerForUser: jest.fn(),
  },
}))

function createResponse(): { body: () => unknown; response: Response; status: () => number } {
  let responseBody: unknown
  let statusCode = 0
  const response = {
    status(code: number) {
      statusCode = code
      return response
    },
    json(body: unknown) {
      responseBody = body
      return response
    },
  }
  return {
    body: () => responseBody,
    response: response as unknown as Response,
    status: () => statusCode,
  }
}

function webhookRequest(): Request {
  return {
    body: Buffer.from('{}'),
    headers: { 'stripe-signature': 'signed' },
  } as unknown as Request
}

describe('BillingController.webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(BillingModel.getCustomerId).mockResolvedValue(null)
    jest.mocked(StripeService.retrieveCustomerForUser).mockResolvedValue({ id: 'cus_vagas' } as never)
    jest.mocked(CheckoutCreditGrantModel.claim).mockResolvedValue({ should_process: true } as never)
    jest.mocked(StripeService.grantCheckoutCredits).mockResolvedValue('cbtxn_vagas')
  })

  it('ignora checkout de outro namespace sem conceder saldo', async () => {
    jest.mocked(StripeService.constructWebhookEvent).mockReturnValue({
      id: 'evt_other',
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: {
            checkoutType: 'credits_pack',
            platform: '10xdev',
            product: '10xdev',
            userId: 'user-1',
          },
          mode: 'payment',
          payment_status: 'paid',
        },
      },
    } as never)
    const result = createResponse()

    await BillingController.webhook(webhookRequest(), result.response)

    expect(StripeService.grantCheckoutCredits).not.toHaveBeenCalled()
    expect(BillingModel.setCustomerId).not.toHaveBeenCalled()
    expect(result.status()).toBe(200)
    expect(result.body()).toEqual({ success: true, data: { received: true } })
  })

  it('concede saldo e vincula customer em checkout 10xvagas pago', async () => {
    jest.mocked(StripeService.constructWebhookEvent).mockReturnValue({
      id: 'evt_vagas',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_vagas',
          amount_total: 2500,
          client_reference_id: 'user-1',
          currency: 'brl',
          customer: 'cus_vagas',
          metadata: {
            checkoutType: 'credits_pack',
            platform: '10xvagas',
            product: '10xvagas',
            userId: 'user-1',
          },
          mode: 'payment',
          payment_intent: 'pi_vagas',
          payment_status: 'paid',
        },
      },
    } as never)
    const result = createResponse()

    await BillingController.webhook(webhookRequest(), result.response)

    expect(StripeService.grantCheckoutCredits).toHaveBeenCalledWith({
      amountCents: 2500,
      currency: 'brl',
      customerId: 'cus_vagas',
      paymentIntentId: 'pi_vagas',
      userId: 'user-1',
    })
    expect(BillingModel.setCustomerId).toHaveBeenCalledWith('user-1', 'cus_vagas')
    expect(CheckoutCreditGrantModel.claim).toHaveBeenCalledWith({
      amountCents: 2500,
      checkoutSessionId: 'cs_vagas',
      currency: 'brl',
      customerId: 'cus_vagas',
      paymentIntentId: 'pi_vagas',
      stripeEventId: 'evt_vagas',
      userId: 'user-1',
    })
    expect(CheckoutCreditGrantModel.markGranted).toHaveBeenCalledWith('pi_vagas', 'cbtxn_vagas')
    expect(result.status()).toBe(200)
  })

  it('nao concede saldo novamente quando o PaymentIntent ja foi processado', async () => {
    jest.mocked(CheckoutCreditGrantModel.claim).mockResolvedValue({ should_process: false } as never)
    jest.mocked(StripeService.constructWebhookEvent).mockReturnValue({
      id: 'evt_retry',
      type: 'checkout.session.async_payment_succeeded',
      data: {
        object: {
          id: 'cs_vagas',
          amount_total: 2500,
          client_reference_id: 'user-1',
          currency: 'brl',
          customer: 'cus_vagas',
          metadata: {
            checkoutType: 'credits_pack',
            platform: '10xvagas',
            product: '10xvagas',
            userId: 'user-1',
          },
          mode: 'payment',
          payment_intent: 'pi_vagas',
          payment_status: 'paid',
        },
      },
    } as never)
    const result = createResponse()

    await BillingController.webhook(webhookRequest(), result.response)

    expect(StripeService.grantCheckoutCredits).not.toHaveBeenCalled()
    expect(CheckoutCreditGrantModel.markGranted).not.toHaveBeenCalled()
    expect(result.status()).toBe(200)
  })

  it('rejeita checkout quando client_reference_id diverge do usuario', async () => {
    jest.mocked(StripeService.constructWebhookEvent).mockReturnValue({
      id: 'evt_mismatch',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_vagas',
          amount_total: 2500,
          client_reference_id: 'other-user',
          currency: 'brl',
          customer: 'cus_vagas',
          metadata: {
            checkoutType: 'credits_pack',
            platform: '10xvagas',
            product: '10xvagas',
            userId: 'user-1',
          },
          mode: 'payment',
          payment_intent: 'pi_vagas',
          payment_status: 'paid',
        },
      },
    } as never)
    const result = createResponse()

    await expect(BillingController.webhook(webhookRequest(), result.response))
      .rejects.toMatchObject({ code: 'CHECKOUT_USER_MISMATCH', status: 422 })
    expect(CheckoutCreditGrantModel.claim).not.toHaveBeenCalled()
  })
})
