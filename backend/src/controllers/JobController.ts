import type { Request, Response } from 'express'
import { JobModel } from '@/models/JobModel'
import type { RadarJob, SourceStatus } from '@/types/job'
import { AppError } from '@/utils/AppError'
import { sendOk } from '@/utils/apiResponse'

const ASSISTED_SOURCES: SourceStatus[] = [
  { id: 'linkedin', label: 'LinkedIn', mode: 'assisted', status: 'assisted', count: 0, lastRunAt: null, error: null },
  { id: 'indeed', label: 'Indeed', mode: 'assisted', status: 'assisted', count: 0, lastRunAt: null, error: null },
]

function requireAuthUserId(req: Request): string {
  if (!req.user) throw new AppError(401, 'Nao autenticado', 'AUTH_REQUIRED')
  return req.user.id
}

function sourceStatuses(jobs: RadarJob[]): SourceStatus[] {
  const sources = new Map<string, SourceStatus>()
  for (const job of jobs) {
    const current = sources.get(job.source)
    sources.set(job.source, {
      id: job.source,
      label: job.sourceLabel,
      mode: 'automatic',
      status: 'ok',
      count: (current?.count ?? 0) + 1,
      lastRunAt: null,
      error: null,
    })
  }
  return [...sources.values(), ...ASSISTED_SOURCES]
}

function pagination(req: Request): { limit: number; offset: number } {
  const rawLimit = req.query['limit'] ?? '50'
  const rawOffset = req.query['offset'] ?? '0'
  const limit = Number(rawLimit)
  const offset = Number(rawOffset)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
    throw new AppError(422, 'Paginacao invalida', 'INVALID_PAGINATION')
  }
  return { limit, offset }
}

export const JobController = {
  /** GET /jobs */
  async list(req: Request, res: Response): Promise<void> {
    const options = pagination(req)
    const { jobs, collectedAt, sources, total } = await JobModel.listByUser(requireAuthUserId(req), options)
    sendOk(res, {
      collectedAt,
      jobs,
      pagination: { ...options, hasMore: options.offset + jobs.length < total, total },
      sources: sources.length > 0 ? sources : sourceStatuses(jobs),
    })
  },

  /** GET /jobs/:id — `id` ja e UUID depois de `router.param`. */
  async getById(req: Request, res: Response): Promise<void> {
    const id = req.params['id']
    if (typeof id !== 'string') throw new AppError(404, 'Vaga nao encontrada', 'JOB_NOT_FOUND')
    const job = await JobModel.findByIdForUser(requireAuthUserId(req), id)
    if (!job) throw new AppError(404, 'Vaga nao encontrada', 'JOB_NOT_FOUND')
    sendOk(res, job)
  },
}
