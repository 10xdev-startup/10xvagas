import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { clearAiModelCatalogCache } from '@/config/aiModelCatalog'
import { findAiModel } from '@/config/aiModelCatalog'
import { getDefaultProfileAnalysisModel } from '@/config/aiModelCatalog'
import { getSelectableAiModels } from '@/config/aiModelCatalog'
import { StripeService } from '@/services/stripeService'

jest.mock('@/services/stripeService', () => ({
  StripeService: {
    getAiRateCard: jest.fn(),
    listGatewayModels: jest.fn(),
  },
}))

const tokenTypes = ['input', 'output', 'cached'] as const

describe('aiModelCatalog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    clearAiModelCatalogCache()
    jest.mocked(StripeService.getAiRateCard).mockResolvedValue({
      metadata: { default_profile_analysis_model: 'gpt-5.6-sol' },
      rates: ['gpt-5.6-sol', 'claude-sonnet-5'].flatMap((model) => (
        tokenTypes.map((tokenType) => ({ model, tokenType, unitAmountCents: 0.001 }))
      )),
    })
    jest.mocked(StripeService.listGatewayModels).mockResolvedValue([
      { apiModel: 'openai/gpt-5.6-sol', model: 'gpt-5.6-sol', provider: 'openai' },
      { apiModel: 'anthropic/claude-sonnet-5', model: 'claude-sonnet-5', provider: 'anthropic' },
    ])
  })

  it('deriva modelos e default exclusivamente do rate card e catalogo da Stripe', async () => {
    await expect(findAiModel('gpt-5.6-sol')).resolves.toMatchObject({ label: 'GPT-5.6 Sol' })
    await expect(getDefaultProfileAnalysisModel()).resolves.toMatchObject({ id: 'gpt-5.6-sol' })
    await expect(getSelectableAiModels()).resolves.toHaveLength(2)
    await expect(findAiModel('missing')).resolves.toBeNull()
  })

  it('falha fechado quando o rate card possui tupla duplicada', async () => {
    jest.mocked(StripeService.getAiRateCard).mockResolvedValue({
      metadata: { default_profile_analysis_model: 'gpt-5.6-sol' },
      rates: [
        { model: 'gpt-5.6-sol', tokenType: 'input', unitAmountCents: 1 },
        { model: 'gpt-5.6-sol', tokenType: 'input', unitAmountCents: 1 },
      ],
    })
    clearAiModelCatalogCache()

    await expect(getSelectableAiModels()).rejects.toThrow('RATE_NOT_UNIQUE:gpt-5.6-sol:input')
  })

  it('falha fechado quando o default nao pertence ao rate card', async () => {
    jest.mocked(StripeService.getAiRateCard).mockResolvedValue({
      metadata: { default_profile_analysis_model: 'missing' },
      rates: tokenTypes.map((tokenType) => ({ model: 'gpt-5.6-sol', tokenType, unitAmountCents: 1 })),
    })
    clearAiModelCatalogCache()

    await expect(getDefaultProfileAnalysisModel()).rejects.toThrow('RATE_CARD_DEFAULT_MODEL_UNAVAILABLE')
  })
})
