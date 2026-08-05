import { StripeService } from '@/services/stripeService'
import type { TokenRate } from '@/services/stripeService'

export interface AiModelCatalogEntry {
  apiModel: string
  id: string
  label: string
  provider: 'anthropic' | 'google' | 'openai'
}

interface AiModelCatalog {
  defaultModelId: string
  models: AiModelCatalogEntry[]
}

const REQUIRED_TOKEN_TYPES = ['cached', 'input', 'output'] as const
const SUPPORTED_PROVIDERS = new Set<AiModelCatalogEntry['provider']>(['anthropic', 'google', 'openai'])
const CACHE_TTL_MS = 5 * 60 * 1000

let cachedCatalog: { expiresAt: number; value: AiModelCatalog } | null = null

function formatModelLabel(modelId: string): string {
  return modelId
    .split('-')
    .map((part) => {
      if (part === 'gpt') return 'GPT'
      if (part === 'luna') return 'Lua'
      if (/^\d+(?:\.\d+)*$/.test(part)) return part
      return `${part.charAt(0).toUpperCase()}${part.slice(1)}`
    })
    .join(' ')
    .replace(/^GPT (\d+(?:\.\d+)*) /, 'GPT-$1 ')
}

function validatedRateModels(rates: TokenRate[]): string[] {
  const tuples = new Map<string, Set<string>>()
  for (const rate of rates) {
    const tokenTypes = tuples.get(rate.model) ?? new Set<string>()
    if (tokenTypes.has(rate.tokenType)) throw new Error(`RATE_NOT_UNIQUE:${rate.model}:${rate.tokenType}`)
    tokenTypes.add(rate.tokenType)
    tuples.set(rate.model, tokenTypes)
  }
  const invalid = [...tuples.entries()].find(([, tokenTypes]) => (
    REQUIRED_TOKEN_TYPES.some((tokenType) => !tokenTypes.has(tokenType))
  ))
  if (invalid) throw new Error(`RATE_MODEL_INCOMPLETE:${invalid[0]}`)
  return [...tuples.keys()]
}

async function loadCatalog(): Promise<AiModelCatalog> {
  if (cachedCatalog && cachedCatalog.expiresAt > Date.now()) return cachedCatalog.value

  const [{ metadata, rates }, gatewayModels] = await Promise.all([
    StripeService.getAiRateCard(),
    StripeService.listGatewayModels(),
  ])
  const gatewayByModel = new Map(gatewayModels.map((model) => [model.model, model]))
  const models = validatedRateModels(rates).map((modelId) => {
    const gatewayModel = gatewayByModel.get(modelId)
    if (!gatewayModel || !SUPPORTED_PROVIDERS.has(gatewayModel.provider as AiModelCatalogEntry['provider'])) {
      throw new Error(`RATE_MODEL_UNAVAILABLE_IN_GATEWAY:${modelId}`)
    }
    return {
      apiModel: gatewayModel.apiModel,
      id: modelId,
      label: formatModelLabel(modelId),
      provider: gatewayModel.provider as AiModelCatalogEntry['provider'],
    }
  }).sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))

  if (models.length === 0) throw new Error('RATE_CARD_HAS_NO_AI_MODELS')
  const defaultModelId = metadata['default_profile_analysis_model']
  if (!defaultModelId || !models.some((model) => model.id === defaultModelId)) {
    throw new Error('RATE_CARD_DEFAULT_MODEL_UNAVAILABLE')
  }
  const value = { defaultModelId, models }
  cachedCatalog = { expiresAt: Date.now() + CACHE_TTL_MS, value }
  return value
}

export async function findAiModel(modelId: string): Promise<AiModelCatalogEntry | null> {
  const catalog = await loadCatalog()
  return catalog.models.find((model) => model.id === modelId) ?? null
}

export async function getDefaultProfileAnalysisModel(): Promise<AiModelCatalogEntry> {
  const catalog = await loadCatalog()
  const model = catalog.models.find((item) => item.id === catalog.defaultModelId)
  if (!model) throw new Error(`PROFILE_ANALYSIS_MODEL_UNAVAILABLE:${catalog.defaultModelId}`)
  return model
}

export async function getSelectableAiModels(): Promise<readonly AiModelCatalogEntry[]> {
  return (await loadCatalog()).models
}

export function clearAiModelCatalogCache(): void {
  cachedCatalog = null
}
