import { beforeEach, describe, expect, it } from '@jest/globals'

declare const jest: typeof import('@jest/globals').jest

const maybeSingle = jest.fn<() => Promise<{ data: unknown; error: unknown }>>()
const from = jest.fn(() => ({ select: () => ({ maybeSingle }) }))

jest.mock('../lib/supabase/server', () => ({
  createClient: async () => ({ from }),
}))

const FULL_DOCUMENT = {
  identity: {
    full_name: 'Augusto Amado',
    headline: { pt: 'Dev', en: 'Dev' },
    location: { city: 'Belo Horizonte', state: 'MG', country: 'Brasil' },
    // Campos privados que existem no documento e nao podem chegar ao client.
    contact: { email: 'privado@example.com', phone: '+55 11 90000-0000' },
  },
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

  it('devolve null quando a conta nao tem perfil, em vez do perfil de outra pessoa', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    const { getCanonicalProfile } = await import('@/lib/profile')
    await expect(getCanonicalProfile()).resolves.toBeNull()
  })

  it('devolve null quando a consulta falha, sem vazar erro interno', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'permission denied' } })
    const { getCanonicalProfile } = await import('@/lib/profile')
    await expect(getCanonicalProfile()).resolves.toBeNull()
  })

  it('nao expoe contato nem narrativas privadas ao client', async () => {
    maybeSingle.mockResolvedValue({ data: { document: FULL_DOCUMENT }, error: null })
    const { getCanonicalProfile } = await import('@/lib/profile')
    const profile = await getCanonicalProfile()

    expect(profile?.identity.full_name).toBe('Augusto Amado')
    expect(JSON.stringify(profile)).not.toContain('privado@example.com')
    expect(JSON.stringify(profile)).not.toContain('+55 11 90000-0000')
    expect(JSON.stringify(profile)).not.toContain('texto privado')
    expect(profile).not.toHaveProperty('narratives')
    expect(profile?.identity).not.toHaveProperty('contact')
  })

  it('le da tabela profile, deixando a RLS isolar por usuario', async () => {
    maybeSingle.mockResolvedValue({ data: { document: FULL_DOCUMENT }, error: null })
    const { getCanonicalProfile } = await import('@/lib/profile')
    await getCanonicalProfile()
    expect(from).toHaveBeenCalledWith('profile')
  })
})
