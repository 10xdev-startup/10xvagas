import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { NextFunction, Request, Response } from 'express'
import { JobModel } from '@/models/JobModel'
import { resolveJobIdParam } from '@/routes/jobRouteParams'

jest.mock('@/models/JobModel', () => ({ JobModel: { resolveId: jest.fn() } }))

const resolveIdMock = JobModel.resolveId as jest.MockedFunction<typeof JobModel.resolveId>
const response = {} as Response

describe('resolveJobIdParam', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('aceita a identidade canonica antes do parser e nao consulta o model', async () => {
    const id = 'ABC12345-6789-4ABC-8DEF-0123456789AB'
    const req = { params: { id } } as unknown as Request
    const next = jest.fn() as NextFunction

    await resolveJobIdParam(req, response, next, id)

    expect(req.params['id']).toBe(id.toLowerCase())
    expect(resolveIdMock).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })

  it('sobrescreve o parametro com UUID antes do controller', async () => {
    const id = 'abc12345-6789-4abc-8def-0123456789ab'
    resolveIdMock.mockResolvedValue({ status: 'resolved', id })
    const req = { params: { id: 'backend-abc123' } } as unknown as Request
    const next = jest.fn() as NextFunction

    await resolveJobIdParam(req, response, next, 'backend-abc123')

    expect(req.params['id']).toBe(id)
    expect(next).toHaveBeenCalledWith()
  })

  it('trata ausencia como 404 sem revelar detalhes', async () => {
    resolveIdMock.mockResolvedValue({ status: 'not_found' })
    const next = jest.fn() as NextFunction

    await resolveJobIdParam({ params: {} } as Request, response, next, 'missing-123abc')

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404, code: 'JOB_NOT_FOUND' }))
  })

  it('registra ids e devolve 404 quando o prefixo e ambiguo', async () => {
    const ids = ['abc12311-1111-4111-8111-111111111111', 'abc12322-2222-4222-8222-222222222222']
    resolveIdMock.mockResolvedValue({ status: 'ambiguous', ids })
    const next = jest.fn() as NextFunction
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    await resolveJobIdParam({ params: {} } as Request, response, next, 'backend-abc123')

    expect(error).toHaveBeenCalledWith(expect.stringContaining('Slug ambiguo'), { slug: 'backend-abc123', ids })
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404, code: 'JOB_NOT_FOUND' }))
    error.mockRestore()
  })
})
