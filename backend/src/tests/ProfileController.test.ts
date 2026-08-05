import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { Request, Response } from 'express'
import { ProfileController } from '@/controllers/ProfileController'
import { ProfileModel } from '@/models/ProfileModel'

jest.mock('@/models/ProfileModel', () => ({ ProfileModel: { findByUser: jest.fn() } }))

function response(): { body: () => unknown; response: Response; status: () => number } {
  let body: unknown
  let status = 0
  const res = {
    status(value: number) { status = value; return res },
    json(value: unknown) { body = value; return res },
  }
  return { body: () => body, response: res as unknown as Response, status: () => status }
}

describe('ProfileController.get', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('usa somente user_id autenticado e nao expoe contato ou narrativas', async () => {
    jest.mocked(ProfileModel.findByUser).mockResolvedValue({
      document: {
        experience: [],
        facts_pending_confirmation: [],
        identity: {
          contact: { email: 'private@example.com' },
          full_name: 'Augusto',
          headline: { en: 'Developer', pt: 'Desenvolvedor' },
          location: { city: 'Belo Horizonte', country: 'Brasil', state: 'MG' },
        },
        narratives: { bio: 'privada' },
        skills_desired: [],
        skills_known: {
          desired_and_evidenced: [],
          known_but_not_desired_for_matching: [],
          secondary_or_limited_evidence: [],
        },
        work_preferences: {
          accepted_employment_types: null,
          desired_work_models: [],
          hybrid_locations: [],
          salary_expectations: [],
          target_markets: [],
          target_roles: [],
          target_seniority: null,
        },
      },
      user_id: 'user-1',
    })
    const result = response()

    await ProfileController.get({ user: { id: 'user-1' } } as Request, result.response)

    expect(ProfileModel.findByUser).toHaveBeenCalledWith('user-1')
    expect(result.status()).toBe(200)
    expect(JSON.stringify(result.body())).not.toContain('private@example.com')
    expect(JSON.stringify(result.body())).not.toContain('privada')
    expect(result.body()).toMatchObject({ success: true, data: { profile: { identity: { full_name: 'Augusto' } } } })
  })
})
