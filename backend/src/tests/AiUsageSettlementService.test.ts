import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { AiUsageModel } from '@/models/AiUsageModel'
import { AiUsageSettlementService } from '@/services/aiUsageSettlementService'
import { StripeService } from '@/services/stripeService'
import type { AiUsageEventRow } from '@/types/aiUsage'

jest.mock('@/models/AiUsageModel', () => ({
  AiUsageModel: {
    claimPending: jest.fn(),
    markSettled: jest.fn(),
    releaseAfterFailure: jest.fn(),
  },
}))

jest.mock('@/services/stripeService', () => ({
  StripeService: {
    calculateUsageCostCents: jest.fn(),
    debitUsage: jest.fn(),
    emitFeatureUsage: jest.fn(),
    emitTokenUsage: jest.fn(),
  },
}))

const event: AiUsageEventRow = {
  api_model: 'openai/gpt-5.6-terra',
  analysis_id: 'analysis-1',
  cached_tokens: 50,
  cost_cents: null,
  created_at: '2026-08-03T12:00:00.000Z',
  id: 'usage-1',
  feature_meter_status: 'pending',
  input_tokens: 1000,
  job_id: 'job-1',
  model: 'gpt-5.6-terra',
  meter_identifiers: {
    cached: 'usage-1:cached',
    feature: 'job-1:profile_extracted',
    input: 'usage-1:input',
    output: 'usage-1:output',
  },
  meter_error: null,
  meter_status: 'pending',
  operation: 'profile_analysis',
  output_tokens: 500,
  provider: 'openai',
  requested_model: 'gpt-5.6-terra',
  settlement_attempts: 1,
  settlement_error: null,
  settlement_status: 'processing',
  stripe_balance_transaction_id: null,
  stripe_customer_id: 'cus_vagas',
  total_tokens: 1550,
  updated_at: '2026-08-03T12:00:00.000Z',
  user_id: 'user-1',
}

describe('AiUsageSettlementService', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('liquida consumo com a identidade persistida e marca como settled', async () => {
    jest.mocked(AiUsageModel.claimPending).mockResolvedValue(event)
    jest.mocked(StripeService.calculateUsageCostCents).mockResolvedValue(7)
    jest.mocked(StripeService.debitUsage).mockResolvedValue('cbtxn_1')

    await expect(AiUsageSettlementService.settleNext()).resolves.toBe(true)

    expect(StripeService.debitUsage).toHaveBeenCalledWith({
      amountCents: 7,
      customerId: 'cus_vagas',
      usageEventId: 'usage-1',
      userId: 'user-1',
    })
    expect(StripeService.emitTokenUsage).toHaveBeenCalledTimes(3)
    expect(StripeService.emitTokenUsage).toHaveBeenCalledWith({
      customerId: 'cus_vagas',
      identifier: 'usage-1:input',
      model: 'gpt-5.6-terra',
      tokens: 1000,
      tokenType: 'input',
    })
    expect(AiUsageModel.markSettled).toHaveBeenCalledWith('usage-1', 7, 'cbtxn_1', 'emitted')
    expect(StripeService.emitFeatureUsage).toHaveBeenCalledWith({
      customerId: 'cus_vagas',
      feature: 'profile_extracted',
      identifier: 'job-1:profile_extracted',
    })
  })

  it('retry reutiliza o mesmo usageEventId e portanto a mesma chave idempotente', async () => {
    jest.mocked(AiUsageModel.claimPending).mockResolvedValue(event)
    jest.mocked(StripeService.calculateUsageCostCents).mockResolvedValue(7)
    jest.mocked(StripeService.debitUsage).mockResolvedValue('cbtxn_1')

    await AiUsageSettlementService.settleNext()
    await AiUsageSettlementService.settleNext()

    expect(StripeService.debitUsage).toHaveBeenNthCalledWith(1, expect.objectContaining({ usageEventId: 'usage-1' }))
    expect(StripeService.debitUsage).toHaveBeenNthCalledWith(2, expect.objectContaining({ usageEventId: 'usage-1' }))
  })

  it('falha fechada quando a rate nao e unica', async () => {
    jest.mocked(AiUsageModel.claimPending).mockResolvedValue(event)
    jest.mocked(StripeService.calculateUsageCostCents).mockRejectedValue(new Error('RATE_NOT_UNIQUE:gpt-5.6-terra'))

    await expect(AiUsageSettlementService.settleNext()).resolves.toBe(true)

    expect(StripeService.debitUsage).not.toHaveBeenCalled()
    expect(AiUsageModel.releaseAfterFailure).toHaveBeenCalledWith(
      'usage-1',
      'RATE_NOT_UNIQUE:gpt-5.6-terra',
      true,
    )
  })
})
