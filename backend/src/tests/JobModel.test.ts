import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { supabase } from '@/database/supabase'
import { JobModel } from '@/models/JobModel'

jest.mock('@/database/supabase', () => ({ supabase: { from: jest.fn() } }))

const fromMock = supabase.from as unknown as jest.Mock

function mockResolveRows(rows: Array<{ id: string }>): { gte: jest.Mock; lte: jest.Mock; limit: jest.Mock } {
  const limit = jest.fn().mockResolvedValue({ data: rows, error: null } as never)
  const lte = jest.fn().mockReturnValue({ limit })
  const gte = jest.fn().mockReturnValue({ lte })
  fromMock.mockReturnValue({ select: jest.fn().mockReturnValue({ gte }) })
  return { gte, lte, limit }
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
    const jobOrder = jest.fn().mockResolvedValue({ data: [], error: null } as never)
    const userEq = jest.fn().mockResolvedValue({ data: [], error: null } as never)
    const sourceLimit = jest.fn().mockResolvedValue({ data: [], error: null } as never)
    const sourceOrder = jest.fn().mockReturnValue({ limit: sourceLimit })
    fromMock.mockImplementation((table: unknown) => {
      if (table === 'job') return { select: jest.fn().mockReturnValue({ order: jobOrder }) }
      if (table === 'job_match') return { select: jest.fn().mockReturnValue({ eq: userEq }) }
      return { select: jest.fn().mockReturnValue({ order: sourceOrder }) }
    })

    await expect(JobModel.listByUser('user-1')).resolves.toEqual({ jobs: [], collectedAt: null, sources: [] })

    expect(userEq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(sourceOrder).toHaveBeenCalledWith('collected_at', { ascending: false })
    expect(sourceLimit).toHaveBeenCalledWith(100)
  })
})
