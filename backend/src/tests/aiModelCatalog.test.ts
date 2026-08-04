import { describe, expect, it } from '@jest/globals'
import { AI_MODEL_CATALOG, findAiModel, getDefaultProfileAnalysisModel } from '@/config/aiModelCatalog'

describe('aiModelCatalog', () => {
  it('resolve o modelo persistido separadamente da sua selecao', () => {
    expect(findAiModel('gpt-5.6-terra')).toMatchObject({ selectable: true })
    expect(findAiModel('missing')).toBeNull()
    expect(new Set(AI_MODEL_CATALOG.map((model) => model.id)).size).toBe(AI_MODEL_CATALOG.length)
  })

  it('falha fechado quando a configuracao aponta para modelo ausente', () => {
    const previous = process.env['PROFILE_ANALYSIS_MODEL_ID']
    process.env['PROFILE_ANALYSIS_MODEL_ID'] = 'missing'
    expect(() => getDefaultProfileAnalysisModel()).toThrow('PROFILE_ANALYSIS_MODEL_UNAVAILABLE')
    if (previous === undefined) delete process.env['PROFILE_ANALYSIS_MODEL_ID']
    else process.env['PROFILE_ANALYSIS_MODEL_ID'] = previous
  })
})
