import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface AiModelCatalogEntry {
  apiModel: string
  id: string
  label: string
  provider: 'openai'
  selectable: boolean
}

interface AiModelCatalogDocument {
  defaultProfileAnalysisModelId: string
  models: AiModelCatalogEntry[]
}

function loadCatalog(): AiModelCatalogDocument {
  const path = resolve(__dirname, '../../../shared/ai-model-catalog.json')
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<AiModelCatalogDocument>
  if (!parsed.defaultProfileAnalysisModelId || !Array.isArray(parsed.models) || parsed.models.length === 0) {
    throw new Error('AI_MODEL_CATALOG_INVALID')
  }
  const ids = new Set<string>()
  for (const model of parsed.models) {
    if (!model.id || !model.label || !model.apiModel || model.provider !== 'openai' || typeof model.selectable !== 'boolean' || ids.has(model.id)) {
      throw new Error('AI_MODEL_CATALOG_INVALID')
    }
    ids.add(model.id)
  }
  return parsed as AiModelCatalogDocument
}

const catalog = loadCatalog()

/** IDs persistidos nunca sao removidos: modelos aposentados mudam apenas selectable. */
export const AI_MODEL_CATALOG: readonly AiModelCatalogEntry[] = catalog.models

export function findAiModel(modelId: string): AiModelCatalogEntry | null {
  return AI_MODEL_CATALOG.find((model) => model.id === modelId) ?? null
}

export function getDefaultProfileAnalysisModel(): AiModelCatalogEntry {
  const modelId = process.env['PROFILE_ANALYSIS_MODEL_ID']?.trim() || catalog.defaultProfileAnalysisModelId
  const model = findAiModel(modelId)
  if (!model || !model.selectable) throw new Error(`PROFILE_ANALYSIS_MODEL_UNAVAILABLE:${modelId}`)
  return model
}
