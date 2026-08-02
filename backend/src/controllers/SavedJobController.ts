import type { Request, Response } from 'express'
import { SavedJobModel } from '@/models/SavedJobModel'
import type { JobMarket, JobRadarStatus, SavedJobSnapshot } from '@/types/savedJob'
import { rowToSavedJob } from '@/types/savedJob'
import { AppError } from '@/utils/AppError'
import { sendOk } from '@/utils/apiResponse'

function requireAuthUserId(req: Request): string {
  if (!req.user) throw new AppError(401, 'Nao autenticado', 'AUTH_REQUIRED')
  return req.user.id
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(422, `${field} deve ser uma string nao vazia`, 'INVALID_SAVED_JOB')
  }
  return value.trim()
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new AppError(422, `${field} deve ser uma string`, 'INVALID_SAVED_JOB')
  }
  return value
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null
  if (typeof value !== 'string') {
    throw new AppError(422, `${field} deve ser string ou null`, 'INVALID_SAVED_JOB')
  }
  return value
}

function nullableNumber(value: unknown, field: string): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AppError(422, `${field} deve ser numero ou null`, 'INVALID_SAVED_JOB')
  }
  return value
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new AppError(422, `${field} deve ser uma lista de strings`, 'INVALID_SAVED_JOB')
  }
  return value.map((item) => (item as string).trim()).filter(Boolean)
}

function marketValue(value: unknown): JobMarket {
  if (value !== 'brazil' && value !== 'international') {
    throw new AppError(422, 'snapshot.market invalido', 'INVALID_SAVED_JOB')
  }
  return value
}

function statusValue(value: unknown): JobRadarStatus {
  if (value !== 'matched' && value !== 'new') {
    throw new AppError(422, 'snapshot.status invalido', 'INVALID_SAVED_JOB')
  }
  return value
}

function parseSnapshot(value: unknown): SavedJobSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(422, 'snapshot deve ser um objeto', 'INVALID_SAVED_JOB')
  }
  const input = value as Record<string, unknown>
  const score = nullableNumber(input['score'], 'snapshot.score')
  const rank = nullableNumber(input['rank'], 'snapshot.rank')
  if (score !== null && (score < 0 || score > 100)) {
    throw new AppError(422, 'snapshot.score deve estar entre 0 e 100', 'INVALID_SAVED_JOB')
  }
  if (rank !== null && (!Number.isInteger(rank) || rank < 1)) {
    throw new AppError(422, 'snapshot.rank deve ser inteiro positivo', 'INVALID_SAVED_JOB')
  }

  return {
    market: marketValue(input['market']),
    company: requiredString(input['company'], 'snapshot.company'),
    title: requiredString(input['title'], 'snapshot.title'),
    source: requiredString(input['source'], 'snapshot.source'),
    sourceLabel: requiredString(input['sourceLabel'], 'snapshot.sourceLabel'),
    sourceUrl: requiredString(input['sourceUrl'], 'snapshot.sourceUrl'),
    applyUrl: nullableString(input['applyUrl'], 'snapshot.applyUrl'),
    description: stringValue(input['description'], 'snapshot.description'),
    location: requiredString(input['location'], 'snapshot.location'),
    workplaceType: requiredString(input['workplaceType'], 'snapshot.workplaceType'),
    employmentType: nullableString(input['employmentType'], 'snapshot.employmentType'),
    salary: nullableString(input['salary'], 'snapshot.salary'),
    publishedAt: nullableString(input['publishedAt'], 'snapshot.publishedAt'),
    score,
    rank,
    reasons: stringArray(input['reasons'], 'snapshot.reasons'),
    gaps: stringArray(input['gaps'], 'snapshot.gaps'),
    skills: stringArray(input['skills'], 'snapshot.skills'),
    status: statusValue(input['status']),
  }
}

export const SavedJobController = {
  /** GET /saved-jobs */
  async list(req: Request, res: Response): Promise<void> {
    const rows = await SavedJobModel.listByUser(requireAuthUserId(req))
    sendOk(res, rows.map(rowToSavedJob))
  },

  /** POST /saved-jobs — salva ou atualiza o snapshot da mesma vaga. */
  async save(req: Request, res: Response): Promise<void> {
    const userId = requireAuthUserId(req)
    const body = (req.body ?? {}) as Record<string, unknown>
    const jobKey = requiredString(body['jobKey'], 'jobKey')
    const snapshot = parseSnapshot(body['snapshot'])
    const row = await SavedJobModel.save({ userId, jobKey, snapshot })
    sendOk(res, rowToSavedJob(row))
  },

  /** DELETE /saved-jobs/:jobKey */
  async remove(req: Request, res: Response): Promise<void> {
    const userId = requireAuthUserId(req)
    const jobKey = requiredString(req.params['jobKey'], 'jobKey')
    const removed = await SavedJobModel.remove(userId, jobKey)
    sendOk(res, { jobKey, removed })
  },
}
