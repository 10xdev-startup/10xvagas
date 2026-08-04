export type ApplyProfileAnswersResult = {
  appliedFields: string[]
  document: Record<string, unknown>
  errors: Array<{ field: string; message: string }>
}

type AnswerParser = (answer: string) => unknown

const list = (answer: string): string[] => answer
  .split(/[,;\n]/)
  .map((item) => item.trim())
  .filter(Boolean)

function positiveNumber(answer: string): number {
  const value = Number(answer.trim().replace(',', '.'))
  if (!Number.isFinite(value) || value <= 0) throw new Error('informe um número maior que zero')
  return value
}

function nonNegativeNumber(answer: string): number {
  const value = Number(answer.trim().replace(',', '.'))
  if (!Number.isFinite(value) || value < 0) throw new Error('informe um número igual ou maior que zero')
  return value
}

function seniority(answer: string): number {
  const value = Number(answer.trim())
  if (!Number.isInteger(value) || value < 1 || value > 5) throw new Error('informe um nível inteiro entre 1 e 5')
  return value
}

function booleanAnswer(answer: string): boolean {
  const value = answer.trim().toLocaleLowerCase('pt-BR')
  if (['sim', 'yes', 'true'].includes(value)) return true
  if (['não', 'nao', 'no', 'false'].includes(value)) return false
  throw new Error('responda sim ou não')
}

function salaryAmount(value: string): number {
  const normalized = /^\d{1,3}(?:\.\d{3})+$/.test(value)
    ? value.replaceAll('.', '')
    : value.replace(',', '.')
  const amount = Number(normalized)
  if (!Number.isInteger(amount) || amount < 0) throw new Error('valor salarial inválido')
  return amount
}

function salaryExpectations(answer: string): unknown[] {
  const trimmed = answer.trim()
  if (trimmed.startsWith('[')) {
    const parsed: unknown = JSON.parse(trimmed)
    if (!Array.isArray(parsed)) throw new Error('use uma lista JSON')
    return parsed
  }
  return trimmed.split(';').map((entry) => {
    const match = entry.trim().match(/^(BRL|USD|EUR)\s+([\d.,]+)(?:\s*(?:-|a)\s*([\d.,]+))?\s*(?:\/|por\s+)?(hora|hour|m[eê]s|mes|month|ano|year)(?:\s+(.+))?$/i)
    if (!match?.[1] || !match[2] || !match[4]) {
      throw new Error('use “BRL 8000/mês CLT; USD 4000/mês contractor”')
    }
    const periodAliases: Record<string, 'hour' | 'month' | 'year'> = {
      ano: 'year', hour: 'hour', hora: 'hour', mes: 'month', mês: 'month', month: 'month', year: 'year',
    }
    return {
      currency: match[1].toUpperCase(),
      employment_type: match[5]?.trim() || null,
      maximum: match[3] ? salaryAmount(match[3]) : null,
      minimum: salaryAmount(match[2]),
      period: periodAliases[match[4].toLocaleLowerCase('pt-BR')],
    }
  })
}

function desiredWorkModels(answer: string): string[] {
  const aliases: Record<string, string> = {
    hibrido: 'hybrid', híbrido: 'hybrid', hybrid: 'hybrid', onsite: 'onsite', presencial: 'onsite', remote: 'remote', remoto: 'remote',
  }
  const values = list(answer).map((item) => aliases[item.toLocaleLowerCase('pt-BR')])
  if (values.some((item) => !item)) throw new Error('use remoto, híbrido e/ou presencial')
  return [...new Set(values as string[])]
}

const PARSERS: Record<string, AnswerParser> = {
  'matching_facts.commercial_production_experience': booleanAnswer,
  'matching_facts.has_ai_project': booleanAnswer,
  'matching_facts.has_completed_higher_education': booleanAnswer,
  'matching_facts.professional_development_years_approx': nonNegativeNumber,
  'matching_facts.startup_founder_experience': booleanAnswer,
  'work_preferences.accepted_employment_types': list,
  'work_preferences.availability': (answer) => answer.trim(),
  'work_preferences.clt_equivalence_factor': positiveNumber,
  'work_preferences.desired_work_models': desiredWorkModels,
  'work_preferences.salary_expectations': salaryExpectations,
  'work_preferences.target_markets': list,
  'work_preferences.target_roles': list,
  'work_preferences.target_seniority': seniority,
  'work_preferences.work_authorization_by_region': (answer) => list(answer).map((item) => item.toUpperCase()),
}

function setPath(document: Record<string, unknown>, field: string, value: unknown): void {
  const parts = field.split('.')
  let current = document
  for (const part of parts.slice(0, -1)) {
    const nested = current[part]
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) throw new Error('caminho não existe no perfil')
    current = nested as Record<string, unknown>
  }
  const leaf = parts.at(-1)
  if (!leaf) throw new Error('campo inválido')
  current[leaf] = value
}

export function applyAnswersToProfileDraft(
  source: Record<string, unknown>,
  answers: Record<string, string>,
): ApplyProfileAnswersResult {
  const document = JSON.parse(JSON.stringify(source)) as Record<string, unknown>
  const appliedFields: string[] = []
  const errors: Array<{ field: string; message: string }> = []
  for (const [field, rawAnswer] of Object.entries(answers)) {
    const answer = rawAnswer.trim()
    if (!answer) continue
    const parser = PARSERS[field]
    if (!parser) {
      errors.push({ field, message: 'campo ainda exige edição no rascunho avançado' })
      continue
    }
    try {
      setPath(document, field, parser(answer))
      appliedFields.push(field)
    } catch (error) {
      errors.push({ field, message: error instanceof Error ? error.message : 'resposta inválida' })
    }
  }
  const pending = document['facts_pending_confirmation']
  if (Array.isArray(pending)) {
    document['facts_pending_confirmation'] = pending.filter((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return true
      return !appliedFields.includes(String((item as Record<string, unknown>)['field'] ?? ''))
    })
  }
  return { appliedFields, document, errors }
}
