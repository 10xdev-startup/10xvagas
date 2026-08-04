import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { Request, Response } from 'express'
import { ProfileAnalysisController } from '@/controllers/ProfileAnalysisController'
import { ProfileAnalysisModel } from '@/models/ProfileAnalysisModel'
import { BillingCustomerService } from '@/services/billingCustomerService'
import { ProfileDocumentService } from '@/services/profileDocumentService'
import type { ProfileAnalysisJobRow, ProfileAnalysisRow } from '@/types/profileAnalysis'
import type { AuthUser } from '@/types/user'

jest.mock('@/models/ProfileAnalysisModel', () => ({
  ProfileAnalysisModel: {
    approve: jest.fn(),
    createJob: jest.fn(),
    findActiveByUser: jest.fn(),
    findAnalysisByJob: jest.fn(),
    findJobByUser: jest.fn(),
    listJobsByUser: jest.fn(),
    requestCancel: jest.fn(),
  },
}))

jest.mock('@/services/billingCustomerService', () => ({
  BillingCustomerService: { requireAvailableCredits: jest.fn() },
}))

jest.mock('@/services/profileDocumentService', () => ({
  ProfileDocumentService: { remove: jest.fn(), upload: jest.fn() },
}))

const user: AuthUser = {
  avatarUrl: null,
  email: 'user@example.com',
  id: 'user-1',
  name: 'User',
  role: 'user',
  status: 'active',
}

const preferences = {
  desiredSkills: [{ name: 'TypeScript', priority: 3 as const }],
  focus: 'backend' as const,
  language: 'pt' as const,
  markets: 'both' as const,
  targetRoles: ['Backend Engineer'],
}

function job(status: ProfileAnalysisJobRow['status'] = 'queued'): ProfileAnalysisJobRow {
  return {
    attempt_count: 0,
    cancel_requested_at: null,
    claimed_at: null,
    created_at: '2026-08-03T12:00:00.000Z',
    current_step: 'Aguardando processamento',
    document_mime_type: 'text/plain',
    document_name: 'cv.txt',
    document_path: 'user-1/job-1/document.txt',
    error_code: null,
    error_message: null,
    finished_at: null,
    heartbeat_at: null,
    id: 'job-1',
    lease_expires_at: null,
    model_id: 'gpt-5.6-terra',
    preferences,
    progress: 0,
    retry_of_job_id: null,
    started_at: null,
    status,
    stripe_customer_id: 'cus_vagas',
    updated_at: '2026-08-03T12:00:00.000Z',
    user_id: 'user-1',
    worker_id: null,
  }
}

function analysis(): ProfileAnalysisRow {
  return {
    approved_at: null,
    canonical_profile_draft: {
      identity: {},
      matching_facts: {
        commercial_production_experience: true,
        has_ai_project: true,
        has_completed_higher_education: false,
        professional_development_years_approx: 2,
        startup_founder_experience: true,
      },
      skills_desired: [],
      skills_known: {
        desired_and_evidenced: [],
        known_but_not_desired_for_matching: [],
        secondary_or_limited_evidence: [],
      },
      work_preferences: {},
    },
    created_at: '2026-08-03T12:10:00.000Z',
    cv_assessment: {},
    id: 'analysis-1',
    job_id: 'job-1',
    model_id: 'gpt-5.6-terra',
    pending_questions: [],
    prompt_version: 'profile-analysis-v1',
    source_evidence: [],
    updated_at: '2026-08-03T12:10:00.000Z',
    user_id: 'user-1',
  }
}

function response(): { json: jest.Mock; res: Response; status: jest.Mock } {
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  return { json, res: { status } as unknown as Response, status }
}

describe('ProfileAnalysisController', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('cria job com user_id apenas da sessao e responde no envelope', async () => {
    jest.mocked(ProfileAnalysisModel.findActiveByUser).mockResolvedValue(null)
    jest.mocked(BillingCustomerService.requireAvailableCredits).mockResolvedValue({
      balanceCents: 1000,
      currency: 'BRL',
      customer: { id: 'cus_vagas' } as never,
    })
    jest.mocked(ProfileDocumentService.upload).mockResolvedValue({ documentName: 'cv.txt', documentPath: 'user-1/job-1/document.txt' })
    jest.mocked(ProfileAnalysisModel.createJob).mockImplementation(async (input) => ({ ...job(), id: input.id }))
    const result = response()
    const req = {
      body: { preferences: JSON.stringify({ ...preferences, user_id: 'attacker' }) },
      file: { mimetype: 'text/plain' },
      user,
    } as unknown as Request

    await ProfileAnalysisController.create(req, result.res)

    expect(ProfileAnalysisModel.createJob).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }))
    expect(result.status).toHaveBeenCalledWith(202)
    expect(result.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
  })

  it('nao permite consultar job de outro usuario', async () => {
    jest.mocked(ProfileAnalysisModel.findJobByUser).mockResolvedValue(null)
    const result = response()

    await expect(ProfileAnalysisController.get(
      { params: { id: 'job-other' }, user } as unknown as Request,
      result.res,
    )).rejects.toMatchObject({ code: 'PROFILE_ANALYSIS_NOT_FOUND', status: 404 })
    expect(ProfileAnalysisModel.findJobByUser).toHaveBeenCalledWith('job-other', 'user-1')
  })

  it('cancela job ainda na fila diretamente sem depender do worker', async () => {
    jest.mocked(ProfileAnalysisModel.findJobByUser).mockResolvedValue(job('queued'))
    jest.mocked(ProfileAnalysisModel.requestCancel).mockResolvedValue(job('cancelled'))
    const result = response()

    await ProfileAnalysisController.cancel(
      { params: { id: 'job-1' }, user } as unknown as Request,
      result.res,
    )

    expect(ProfileAnalysisModel.requestCancel).toHaveBeenCalledWith('job-1', 'user-1', 'queued')
    expect(result.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
  })

  it('aprova somente analise concluida do dono', async () => {
    jest.mocked(ProfileAnalysisModel.findJobByUser).mockResolvedValue(job('succeeded'))
    jest.mocked(ProfileAnalysisModel.findAnalysisByJob).mockResolvedValue(analysis())
    jest.mocked(ProfileAnalysisModel.approve).mockResolvedValue({ ...analysis(), approved_at: '2026-08-03T12:20:00.000Z' })
    const result = response()

    await ProfileAnalysisController.approve(
      { body: {}, params: { id: 'job-1' }, user } as unknown as Request,
      result.res,
    )

    expect(ProfileAnalysisModel.approve).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'job-1', userId: 'user-1' }))
    expect(result.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
  })

  it('rejeita rascunho sem os fatos consumidos pelo matcher', async () => {
    const invalid = analysis()
    invalid.canonical_profile_draft = {
      ...invalid.canonical_profile_draft,
      matching_facts: {},
    }
    jest.mocked(ProfileAnalysisModel.findJobByUser).mockResolvedValue(job('succeeded'))
    jest.mocked(ProfileAnalysisModel.findAnalysisByJob).mockResolvedValue(invalid)
    const result = response()

    await expect(ProfileAnalysisController.approve(
      { body: {}, params: { id: 'job-1' }, user } as unknown as Request,
      result.res,
    )).rejects.toMatchObject({ code: 'INVALID_PROFILE_DRAFT', status: 422 })
    expect(ProfileAnalysisModel.approve).not.toHaveBeenCalled()
  })
})
