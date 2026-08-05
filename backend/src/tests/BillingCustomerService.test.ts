import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { BillingModel } from '@/models/BillingModel'
import { BillingCustomerService } from '@/services/billingCustomerService'
import { StripeService } from '@/services/stripeService'

jest.mock('@/models/BillingModel', () => ({
  BillingModel: { getCustomerId: jest.fn(), setCustomerId: jest.fn() },
}))
jest.mock('@/services/stripeService', () => ({
  StripeService: {
    createCustomer: jest.fn(),
    getBalance: jest.fn(),
    retrieveCustomerForUser: jest.fn(),
  },
}))

describe('BillingCustomerService', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('nao reaproveita Customer armazenado quando ele nao pertence a 10xVagas', async () => {
    jest.mocked(BillingModel.getCustomerId).mockResolvedValue('cus_10xdev')
    jest.mocked(StripeService.retrieveCustomerForUser).mockResolvedValue(null)
    jest.mocked(StripeService.createCustomer).mockResolvedValue({ id: 'cus_10xvagas' } as never)

    await expect(BillingCustomerService.getOrCreate('user-1', 'user@example.com'))
      .resolves.toMatchObject({ id: 'cus_10xvagas' })
    expect(BillingModel.setCustomerId).toHaveBeenCalledWith('user-1', 'cus_10xvagas')
  })

  it('bloqueia a criacao do job antes do upload quando o saldo acabou', async () => {
    jest.mocked(BillingModel.getCustomerId).mockResolvedValue('cus_10xvagas')
    jest.mocked(StripeService.retrieveCustomerForUser).mockResolvedValue({ id: 'cus_10xvagas' } as never)
    jest.mocked(StripeService.getBalance).mockResolvedValue({ balanceCents: 0, currency: 'BRL' })

    await expect(BillingCustomerService.requireAvailableCredits('user-1', 'user@example.com'))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS', status: 402 })
  })
})
