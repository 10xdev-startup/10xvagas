import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { supabase } from '@/database/supabase'
import { JobModel } from '@/models/JobModel'

jest.mock('@/database/supabase', () => ({ supabase: { from: jest.fn() } }))

const fromMock = supabase.from as unknown as jest.Mock

function mockResolveRows(rows: Array<{ id: string }>): { eq: jest.Mock; gte: jest.Mock; lte: jest.Mock; limit: jest.Mock } {
  const limit = jest.fn().mockResolvedValue({ data: rows, error: null } as never)
  const lte = jest.fn().mockReturnValue({ limit })
  const gte = jest.fn().mockReturnValue({ lte })
  const eq = jest.fn().mockReturnValue({ gte })
  fromMock.mockReturnValue({ select: jest.fn().mockReturnValue({ eq }) })
  return { eq, gte, lte, limit }
}

describe('JobModel.resolveId', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  it('consulta a PK UUID por range indexavel e busca dois candidatos', async () => {
    const id = 'abc12345-6789-4abc-8def-0123456789ab'
    const query = mockResolveRows([{ id }])

    await expect(JobModel.resolveId('backend-engineer-abc123')).resolves.toEqual({ status: 'resolved', id })
    expect(fromMock).toHaveBeenCalledWith('job')
    expect(query.eq).toHaveBeenCalledWith('is_active', true)
    expect(query.gte).toHaveBeenCalledWith('id', 'abc12300-0000-0000-0000-000000000000')
    expect(query.lte).toHaveBeenCalledWith('id', 'abc123ff-ffff-ffff-ffff-ffffffffffff')
    expect(query.limit).toHaveBeenCalledWith(2)
  })

  it('devolve ambiguidade com todos os ids encontrados', async () => {
    const ids = [
      'abc12311-1111-4111-8111-111111111111',
      'abc12322-2222-4222-8222-222222222222',
    ]
    mockResolveRows(ids.map((id) => ({ id })))
    await expect(JobModel.resolveId('backend-abc123')).resolves.toEqual({ status: 'ambiguous', ids })
  })

  it('nao consulta o banco para slug malformado ou UUID cru', async () => {
    await expect(JobModel.resolveId('abc12345-6789-4abc-8def-0123456789ab')).resolves.toEqual({ status: 'not_found' })
    expect(fromMock).not.toHaveBeenCalled()
  })
})

describe('JobModel.listByUser', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  it('restringe a consulta de matches por user_id mesmo usando service-role', async () => {
    const row = {
      apply_url: null,
      company: 'Acme',
      created_at: '2026-08-03T12:00:00.000Z',
      employment_type: 'full_time',
      external_id: '42',
      first_seen_at: '2026-08-03T12:00:00.000Z',
      id: 'abc12345-6789-4abc-8def-0123456789ab',
      last_seen_at: '2026-08-03T12:00:00.000Z',
      location: 'Belo Horizonte',
      market: 'brazil',
      published_at: null,
      salary_raw: null,
      source: 'lever',
      source_label: 'Lever',
      source_url: 'https://example.com/42',
      title: 'Backend Engineer',
      updated_at: '2026-08-03T12:00:00.000Z',
      workplace_type: 'hybrid',
    }
    const jobRange = jest.fn().mockResolvedValue({ count: 1, data: [row], error: null } as never)
    const jobOrder = jest.fn().mockReturnValue({ range: jobRange })
    const activeEq = jest.fn().mockReturnValue({ order: jobOrder })
    const matchIn = jest.fn().mockResolvedValue({ data: [], error: null } as never)
    const userEq = jest.fn().mockReturnValue({ in: matchIn })
    const sourceLimit = jest.fn().mockResolvedValue({ data: [], error: null } as never)
    const sourceOrder = jest.fn().mockReturnValue({ limit: sourceLimit })
    fromMock.mockImplementation((table: unknown) => {
      if (table === 'job') return { select: jest.fn().mockReturnValue({ eq: activeEq }) }
      if (table === 'job_match') return { select: jest.fn().mockReturnValue({ eq: userEq }) }
      return { select: jest.fn().mockReturnValue({ order: sourceOrder }) }
    })

    await expect(JobModel.listByUser('user-1', { limit: 25, offset: 50 })).resolves.toMatchObject({
      collectedAt: row.last_seen_at,
      sources: [],
      total: 1,
    })

    expect(activeEq).toHaveBeenCalledWith('is_active', true)
    expect(jobRange).toHaveBeenCalledWith(50, 74)
    expect(userEq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(matchIn).toHaveBeenCalledWith('job_id', [row.id])
    expect(sourceOrder).toHaveBeenCalledWith('collected_at', { ascending: false })
    expect(sourceLimit).toHaveBeenCalledWith(100)
  })
})
