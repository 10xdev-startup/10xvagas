import { beforeEach, describe, expect, it } from '@jest/globals'

declare const jest: typeof import('@jest/globals').jest

const maybeSingle = jest.fn<() => Promise<{ data: unknown; error: unknown }>>()
const from = jest.fn(() => ({ select: () => ({ maybeSingle }) }))

jest.mock('../lib/supabase/server', () => ({ createClient: async () => ({ from }) }))

const FULL_DOCUMENT = {
  identity: { full_name: 'Augusto Amado', headline: { pt: 'Dev', en: 'Dev' }, location: { city: 'Belo Horizonte', state: 'MG', country: 'Brasil' }, contact: { email: 'privado@example.com' } },
  work_preferences: { target_roles: [], desired_work_models: [], hybrid_locations: [], target_markets: [], accepted_employment_types: null, target_seniority: null, salary_expectations: [] },
  skills_desired: [],
  skills_known: { desired_and_evidenced: [], known_but_not_desired_for_matching: [], secondary_or_limited_evidence: [] },
  experience: [],
  facts_pending_confirmation: [],
  narratives: { bio_longa: 'texto privado' },
}

describe('getCanonicalProfile', () => {
  beforeEach(() => {
    jest.resetModules()
    maybeSingle.mockReset()
  })

  it('devolve null quando a conta nao tem perfil', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    const { getCanonicalProfile } = await import('@/lib/profile')
    await expect(getCanonicalProfile()).resolves.toBeNull()
  })

  it('projeta somente campos seguros e deixa a RLS escolher o usuario', async () => {
    maybeSingle.mockResolvedValue({ data: { document: FULL_DOCUMENT }, error: null })
    const { getCanonicalProfile } = await import('@/lib/profile')
    const profile = await getCanonicalProfile()
    expect(from).toHaveBeenCalledWith('profile')
    expect(JSON.stringify(profile)).not.toContain('privado@example.com')
    expect(JSON.stringify(profile)).not.toContain('texto privado')
  })
})
