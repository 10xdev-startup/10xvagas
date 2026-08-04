import { describe, expect, it } from '@jest/globals'
import { applyAnswersToProfileDraft } from '@/lib/profileDraftAnswers'

function draft(): Record<string, unknown> {
  return {
    facts_pending_confirmation: [
      { field: 'work_preferences.target_seniority' },
      { field: 'work_preferences.work_authorization_by_region' },
    ],
    matching_facts: { professional_development_years_approx: 0 },
    work_preferences: {
      accepted_employment_types: null,
      availability: null,
      clt_equivalence_factor: null,
      desired_work_models: [],
      salary_expectations: [],
      target_markets: [],
      target_roles: [],
      target_seniority: null,
      work_authorization_by_region: null,
    },
  }
}

describe('applyAnswersToProfileDraft', () => {
  it('aplica respostas tipadas nos fatos canônicos e remove pendências resolvidas', () => {
    const result = applyAnswersToProfileDraft(draft(), {
      'work_preferences.accepted_employment_types': 'CLT, PJ, contractor',
      'work_preferences.target_seniority': '3',
      'work_preferences.work_authorization_by_region': 'BR, LATAM',
    })
    const preferences = result.document['work_preferences'] as Record<string, unknown>

    expect(preferences['accepted_employment_types']).toEqual(['CLT', 'PJ', 'contractor'])
    expect(preferences['target_seniority']).toBe(3)
    expect(preferences['work_authorization_by_region']).toEqual(['BR', 'LATAM'])
    expect(result.document['facts_pending_confirmation']).toEqual([])
    expect(result.errors).toEqual([])
  })

  it('converte faixa salarial legível sem guardar uma resposta órfã', () => {
    const result = applyAnswersToProfileDraft(draft(), {
      'work_preferences.salary_expectations': 'BRL 8.000/mês CLT; USD 4000/mês contractor',
    })
    const preferences = result.document['work_preferences'] as Record<string, unknown>

    expect(preferences['salary_expectations']).toEqual([
      { currency: 'BRL', employment_type: 'CLT', maximum: null, minimum: 8000, period: 'month' },
      { currency: 'USD', employment_type: 'contractor', maximum: null, minimum: 4000, period: 'month' },
    ])
    expect(result.document).not.toHaveProperty('human_answers')
  })

  it('não altera o perfil quando o campo ou o valor não são suportados', () => {
    const result = applyAnswersToProfileDraft(draft(), {
      'identity.unknown': 'valor',
      'work_preferences.target_seniority': 'sênior',
    })

    expect(result.appliedFields).toEqual([])
    expect(result.errors).toHaveLength(2)
  })
})
