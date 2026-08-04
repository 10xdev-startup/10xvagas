export interface AiModelCatalogEntry {
  id: string
  label: string
  provider: 'openai'
  selectable: boolean
}

/** IDs persistidos nunca sao removidos: modelos aposentados mudam apenas selectable. */
export const AI_MODEL_CATALOG: readonly AiModelCatalogEntry[] = [
  { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', provider: 'openai', selectable: true },
]

export function findAiModel(modelId: string): AiModelCatalogEntry | null {
  return AI_MODEL_CATALOG.find((model) => model.id === modelId) ?? null
}

export function getDefaultProfileAnalysisModel(): AiModelCatalogEntry {
  const modelId = process.env['PROFILE_ANALYSIS_MODEL_ID']?.trim() || 'gpt-5.6-terra'
  const model = findAiModel(modelId)
  if (!model || !model.selectable) throw new Error(`PROFILE_ANALYSIS_MODEL_UNAVAILABLE:${modelId}`)
  return model
}
