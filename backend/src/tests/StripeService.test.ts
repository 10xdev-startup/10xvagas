import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { StripeService } from '@/services/stripeService'

const mockMeterEventCreate = jest.fn()

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    billing: { meterEvents: { create: mockMeterEventCreate } },
  })),
}))

describe('StripeService meter events', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_10xvagas'
    mockMeterEventCreate.mockResolvedValue({ identifier: 'usage-1:input' } as never)
  })

  it('reutiliza o identifier persistido tambem como chave idempotente', async () => {
    const input = {
      customerId: 'cus_10xvagas',
      identifier: 'usage-1:input',
      model: 'gpt-5.6-terra',
      tokenType: 'input' as const,
      tokens: 68,
    }
    await expect(StripeService.emitTokenUsage(input)).resolves.toBe('usage-1:input')
    await expect(StripeService.emitTokenUsage(input)).resolves.toBe('usage-1:input')

    expect(mockMeterEventCreate).toHaveBeenNthCalledWith(
      1,
      {
        event_name: '10xvagas_tokens',
        identifier: 'usage-1:input',
        payload: {
          model: 'gpt-5.6-terra',
          stripe_customer_id: 'cus_10xvagas',
          token_type: 'input',
          value: '68',
        },
      },
      { idempotencyKey: '10xvagas_meter_usage-1:input' },
    )
    expect(mockMeterEventCreate.mock.calls[1]).toEqual(mockMeterEventCreate.mock.calls[0])
  })
})
