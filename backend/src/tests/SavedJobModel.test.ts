import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { supabase } from '@/database/supabase'
import { SavedJobModel } from '@/models/SavedJobModel'
import type { SavedJobRow, SavedJobSnapshot } from '@/types/savedJob'

jest.mock('@/database/supabase', () => ({ supabase: { from: jest.fn() } }))

const snapshot: SavedJobSnapshot = {
  market: 'brazil',
  company: '10xDev',
  title: 'Full-stack Developer',
  source: 'greenhouse',
  sourceLabel: 'Greenhouse',
  sourceUrl: 'https://example.com/jobs/42',
  applyUrl: 'https://example.com/jobs/42/apply',
  description: 'Build products with TypeScript.',
  location: 'Belo Horizonte, MG',
  workplaceType: 'hybrid',
  employmentType: 'full_time',
  salary: 'R$ 12.000',
  publishedAt: '2026-08-01T12:00:00.000Z',
  score: 91,
  rank: 1,
  reasons: ['Stack desejada'],
  gaps: [],
  skills: ['TypeScript', 'Node.js'],
  status: 'matched',
}

const row: SavedJobRow = {
  id: 'saved-1',
  user_id: 'user-1',
  job_key: 'greenhouse:42',
  snapshot,
  created_at: '2026-08-01T13:00:00.000Z',
  updated_at: '2026-08-01T13:00:00.000Z',
}

const fromMock = supabase.from as unknown as jest.Mock

describe('SavedJobModel', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  it('lista apenas as vagas do usuario, da mais recente para a mais antiga', async () => {
    const order = jest.fn().mockResolvedValue({ data: [row], error: null } as never)
    const eq = jest.fn().mockReturnValue({ order })
    const select = jest.fn().mockReturnValue({ eq })
    fromMock.mockReturnValue({ select })

    await expect(SavedJobModel.listByUser('user-1')).resolves.toEqual([row])
    expect(fromMock).toHaveBeenCalledWith('saved_job')
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('salva por upsert idempotente no par user_id e job_key', async () => {
    const single = jest.fn().mockResolvedValue({ data: row, error: null } as never)
    const select = jest.fn().mockReturnValue({ single })
    const upsert = jest.fn().mockReturnValue({ select })
    fromMock.mockReturnValue({ upsert })

    await expect(SavedJobModel.save({ userId: 'user-1', jobKey: 'greenhouse:42', snapshot }))
      .resolves.toEqual(row)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        job_key: 'greenhouse:42',
        snapshot,
      }),
      { onConflict: 'user_id,job_key' },
    )
  })

  it('remove sempre restringindo por usuario e job_key', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: { id: row.id }, error: null } as never)
    const select = jest.fn().mockReturnValue({ maybeSingle })
    const jobEq = jest.fn().mockReturnValue({ select })
    const userEq = jest.fn().mockReturnValue({ eq: jobEq })
    const deleteQuery = jest.fn().mockReturnValue({ eq: userEq })
    fromMock.mockReturnValue({ delete: deleteQuery })

    await expect(SavedJobModel.remove('user-1', 'greenhouse:42')).resolves.toBe(true)
    expect(userEq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(jobEq).toHaveBeenCalledWith('job_key', 'greenhouse:42')
  })

  it('trata remover vaga ausente como operacao idempotente', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null } as never)
    const select = jest.fn().mockReturnValue({ maybeSingle })
    const jobEq = jest.fn().mockReturnValue({ select })
    const userEq = jest.fn().mockReturnValue({ eq: jobEq })
    fromMock.mockReturnValue({ delete: jest.fn().mockReturnValue({ eq: userEq }) })

    await expect(SavedJobModel.remove('user-1', 'missing')).resolves.toBe(false)
  })

  it('propaga erro do Supabase', async () => {
    const order = jest.fn().mockResolvedValue({ data: null, error: { message: 'database down' } } as never)
    const eq = jest.fn().mockReturnValue({ order })
    fromMock.mockReturnValue({ select: jest.fn().mockReturnValue({ eq }) })

    await expect(SavedJobModel.listByUser('user-1')).rejects.toThrow('database down')
  })
})
