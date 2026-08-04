import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { Request, Response } from 'express'
import { JobController } from '@/controllers/JobController'
import { JobModel } from '@/models/JobModel'
import type { RadarJob } from '@/types/job'
import type { AuthUser } from '@/types/user'

jest.mock('@/models/JobModel', () => ({
  JobModel: {
    listByUser: jest.fn(),
    findByIdForUser: jest.fn(),
  },
}))

const authUser: AuthUser = {
  id: 'user-1',
  email: 'augusto@example.com',
  name: 'Augusto',
  role: 'user',
  status: 'active',
  avatarUrl: null,
}

const job: RadarJob = {
  id: 'abc12345-6789-4abc-8def-0123456789ab',
  publicId: 'backend-engineer-abc123',
  market: 'brazil',
  company: 'Acme',
  title: 'Backend Engineer',
  source: 'lever',
  sourceLabel: 'Lever',
  sourceUrl: 'https://example.com/jobs/42',
  applyUrl: null,
  description: 'Build APIs.',
  location: 'Belo Horizonte, MG',
  workplaceType: 'hybrid',
  employmentType: 'full_time',
  salary: null,
  publishedAt: '2026-08-03T12:00:00.000Z',
  score: 91,
  rank: 1,
  reasons: ['Stack alinhada'],
  gaps: [],
  skills: ['TypeScript'],
  status: 'matched',
}

function response(): { res: Response; json: jest.Mock } {
  const json = jest.fn()
  return { res: { status: jest.fn().mockReturnValue({ json }) } as unknown as Response, json }
}

const listByUserMock = JobModel.listByUser as jest.MockedFunction<typeof JobModel.listByUser>
const findByIdMock = JobModel.findByIdForUser as jest.MockedFunction<typeof JobModel.findByIdForUser>

describe('JobController', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('lista no envelope e usa somente o usuario autenticado', async () => {
    listByUserMock.mockResolvedValue({
      jobs: [job],
      collectedAt: '2026-08-03T13:00:00.000Z',
      sources: [{ id: 'lever', label: 'Lever', mode: 'automatic', status: 'ok', count: 1, lastRunAt: '2026-08-03T13:00:00.000Z', error: null }],
      total: 1,
    })
    const { res, json } = response()

    await JobController.list({ user: authUser, body: { user_id: 'attacker' }, query: {} } as unknown as Request, res)

    expect(listByUserMock).toHaveBeenCalledWith(authUser.id, { limit: 50, offset: 0 })
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        jobs: [job],
        pagination: { hasMore: false, limit: 50, offset: 0, total: 1 },
        sources: expect.any(Array),
      }),
    })
  })

  it('rejeita paginação acima do limite do endpoint', async () => {
    const { res } = response()
    const req = { query: { limit: '500', offset: '0' }, user: authUser } as unknown as Request

    await expect(JobController.list(req, res)).rejects.toMatchObject({ code: 'INVALID_PAGINATION', status: 422 })
    expect(listByUserMock).not.toHaveBeenCalled()
  })

  it('busca detalhe com UUID ja resolvido e o user_id da sessao', async () => {
    findByIdMock.mockResolvedValue(job)
    const { res, json } = response()
    const req = { user: authUser, params: { id: job.id } } as unknown as Request

    await JobController.getById(req, res)

    expect(findByIdMock).toHaveBeenCalledWith(authUser.id, job.id)
    expect(json).toHaveBeenCalledWith({ success: true, data: job })
  })

  it('devolve erro de dominio quando a vaga nao existe', async () => {
    findByIdMock.mockResolvedValue(null)
    const { res } = response()
    const req = { user: authUser, params: { id: job.id } } as unknown as Request

    await expect(JobController.getById(req, res)).rejects.toMatchObject({
      status: 404,
      code: 'JOB_NOT_FOUND',
    })
  })
})
