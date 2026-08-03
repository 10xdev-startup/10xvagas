import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { Request, Response } from 'express'
import { SavedJobController } from '@/controllers/SavedJobController'
import { SavedJobModel } from '@/models/SavedJobModel'
import type { SavedJobRow, SavedJobSnapshot } from '@/types/savedJob'
import type { AuthUser } from '@/types/user'

jest.mock('@/models/SavedJobModel', () => ({
  SavedJobModel: {
    listByUser: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
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

const snapshot: SavedJobSnapshot = {
  publicId: 'full-stack-developer-abc123',
  market: 'brazil',
  company: '10xDev',
  title: 'Full-stack Developer',
  source: 'greenhouse',
  sourceLabel: 'Greenhouse',
  sourceUrl: 'https://example.com/jobs/42',
  applyUrl: null,
  description: 'Build products with TypeScript.',
  location: 'Belo Horizonte, MG',
  workplaceType: 'hybrid',
  employmentType: 'full_time',
  salary: null,
  publishedAt: null,
  score: 91,
  rank: 1,
  reasons: ['Stack desejada'],
  gaps: [],
  skills: ['TypeScript'],
  status: 'matched',
}

const row: SavedJobRow = {
  id: 'saved-1',
  user_id: authUser.id,
  job_key: 'greenhouse:42',
  snapshot,
  created_at: '2026-08-01T13:00:00.000Z',
  updated_at: '2026-08-01T13:00:00.000Z',
}

function createResponse(): { res: Response; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  return { res: { status } as unknown as Response, status, json }
}

const listByUserMock = SavedJobModel.listByUser as jest.MockedFunction<typeof SavedJobModel.listByUser>
const saveMock = SavedJobModel.save as jest.MockedFunction<typeof SavedJobModel.save>
const removeMock = SavedJobModel.remove as jest.MockedFunction<typeof SavedJobModel.remove>

describe('SavedJobController', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('lista no envelope usando o id do usuario autenticado', async () => {
    listByUserMock.mockResolvedValue([row])
    const { res, json } = createResponse()

    await SavedJobController.list({ user: authUser } as Request, res)

    expect(listByUserMock).toHaveBeenCalledWith(authUser.id)
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: [expect.objectContaining({ jobKey: row.job_key, snapshot })],
    })
  })

  it('salva o snapshot normalizado para o usuario autenticado', async () => {
    saveMock.mockResolvedValue(row)
    const { res, json } = createResponse()
    const req = { user: authUser, body: { jobKey: row.job_key, snapshot } } as Request

    await SavedJobController.save(req, res)

    expect(saveMock).toHaveBeenCalledWith({ userId: authUser.id, jobKey: row.job_key, snapshot })
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({ jobKey: row.job_key }),
    })
  })

  it('remove por usuario e job_key sem expor registros de outra conta', async () => {
    removeMock.mockResolvedValue(true)
    const { res, json } = createResponse()
    const req = { user: authUser, params: { jobKey: row.job_key } } as unknown as Request

    await SavedJobController.remove(req, res)

    expect(removeMock).toHaveBeenCalledWith(authUser.id, row.job_key)
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: { jobKey: row.job_key, removed: true },
    })
  })

  it('recusa payload incompleto antes de acessar o banco', async () => {
    const { res } = createResponse()
    const req = { user: authUser, body: { jobKey: row.job_key, snapshot: {} } } as Request

    await expect(SavedJobController.save(req, res)).rejects.toMatchObject({
      status: 422,
      code: 'INVALID_SAVED_JOB',
    })
    expect(saveMock).not.toHaveBeenCalled()
  })
})
