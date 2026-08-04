import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import { findAiModel, getDefaultProfileAnalysisModel } from '@/config/aiModelCatalog'
import { ProfileAnalysisModel } from '@/models/ProfileAnalysisModel'
import { BillingCustomerService } from '@/services/billingCustomerService'
import { ProfileDocumentService } from '@/services/profileDocumentService'
import { PROFILE_ANALYSIS_FOCUSES, PROFILE_ANALYSIS_LANGUAGES, PROFILE_ANALYSIS_MARKETS, mapProfileAnalysis, mapProfileAnalysisJob } from '@/types/profileAnalysis'
import type { DesiredSkillInput, ProfileAnalysisPreferences } from '@/types/profileAnalysis'
import { AppError } from '@/utils/AppError'
import { sendOk } from '@/utils/apiResponse'

const TERMINAL_STATUSES = new Set(['cancelled', 'succeeded', 'failed'])

function requireUser(req: Request): NonNullable<Request['user']> {
  if (!req.user) throw new AppError(401, 'Nao autenticado', 'AUTH_REQUIRED')
  return req.user
}

function requireIdParam(req: Request): string {
  const value = req.params['id']
  if (typeof value !== 'string' || !value) {
    throw new AppError(404, 'Analise nao encontrada', 'PROFILE_ANALYSIS_NOT_FOUND')
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseStringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new AppError(422, `${field} deve ser uma lista`, 'INVALID_PREFERENCES')
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
  if (items.length !== value.length || items.length > 30) {
    throw new AppError(422, `${field} possui valores invalidos`, 'INVALID_PREFERENCES')
  }
  return [...new Set(items)]
}

function parseDesiredSkills(value: unknown): DesiredSkillInput[] {
  if (!Array.isArray(value) || value.length > 50) {
    throw new AppError(422, 'desiredSkills deve ser uma lista valida', 'INVALID_PREFERENCES')
  }
  return value.map((item) => {
    if (!isRecord(item) || typeof item['name'] !== 'string' || ![1, 2, 3].includes(Number(item['priority']))) {
      throw new AppError(422, 'Skill desejada invalida', 'INVALID_PREFERENCES')
    }
    const name = item['name'].trim()
    if (!name || name.length > 80) throw new AppError(422, 'Skill desejada invalida', 'INVALID_PREFERENCES')
    return { name, priority: Number(item['priority']) as 1 | 2 | 3 }
  })
}

function parsePreferences(raw: unknown): ProfileAnalysisPreferences {
  let value: unknown = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      throw new AppError(422, 'Preferencias possuem JSON invalido', 'INVALID_PREFERENCES')
    }
  }
  if (!isRecord(value)) throw new AppError(422, 'Preferencias sao obrigatorias', 'INVALID_PREFERENCES')

  const focus = value['focus']
  const language = value['language']
  const markets = value['markets']
  if (typeof focus !== 'string' || !PROFILE_ANALYSIS_FOCUSES.includes(focus as never)) {
    throw new AppError(422, 'Foco profissional invalido', 'INVALID_PREFERENCES')
  }
  if (typeof language !== 'string' || !PROFILE_ANALYSIS_LANGUAGES.includes(language as never)) {
    throw new AppError(422, 'Idioma invalido', 'INVALID_PREFERENCES')
  }
  if (typeof markets !== 'string' || !PROFILE_ANALYSIS_MARKETS.includes(markets as never)) {
    throw new AppError(422, 'Mercado invalido', 'INVALID_PREFERENCES')
  }

  return {
    desiredSkills: parseDesiredSkills(value['desiredSkills']),
    focus: focus as ProfileAnalysisPreferences['focus'],
    language: language as ProfileAnalysisPreferences['language'],
    markets: markets as ProfileAnalysisPreferences['markets'],
    targetRoles: parseStringList(value['targetRoles'], 'targetRoles'),
  }
}

function validateProfileDraft(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new AppError(422, 'Perfil proposto invalido', 'INVALID_PROFILE_DRAFT')
  if (!isRecord(value['identity']) || !isRecord(value['work_preferences'])) {
    throw new AppError(422, 'Perfil proposto nao possui os fatos obrigatorios', 'INVALID_PROFILE_DRAFT')
  }
  if (!Array.isArray(value['skills_desired']) || !isRecord(value['skills_known'])) {
    throw new AppError(422, 'Perfil proposto nao separa as habilidades corretamente', 'INVALID_PROFILE_DRAFT')
  }
  const known = value['skills_known']
  const requiredGroups = [
    'desired_and_evidenced',
    'secondary_or_limited_evidence',
    'known_but_not_desired_for_matching',
  ]
  if (!requiredGroups.every((group) => Array.isArray(known[group]))) {
    throw new AppError(422, 'Grupos de habilidades do perfil sao invalidos', 'INVALID_PROFILE_DRAFT')
  }
  return value
}

async function detailForUser(jobId: string, userId: string) {
  const job = await ProfileAnalysisModel.findJobByUser(jobId, userId)
  if (!job) throw new AppError(404, 'Analise nao encontrada', 'PROFILE_ANALYSIS_NOT_FOUND')
  const analysis = await ProfileAnalysisModel.findAnalysisByJob(jobId, userId)
  return { analysis: analysis ? mapProfileAnalysis(analysis) : null, job: mapProfileAnalysisJob(job) }
}

export const ProfileAnalysisController = {
  async create(req: Request, res: Response): Promise<void> {
    const user = requireUser(req)
    if (!req.file) throw new AppError(422, 'Curriculo e obrigatorio', 'DOCUMENT_REQUIRED')
    const preferences = parsePreferences((req.body as { preferences?: unknown } | undefined)?.preferences)
    const requestedModel = (req.body as { modelId?: unknown } | undefined)?.modelId
    const modelId = typeof requestedModel === 'string' && requestedModel.trim()
      ? requestedModel.trim()
      : getDefaultProfileAnalysisModel().id
    if (!findAiModel(modelId)?.selectable) throw new AppError(422, 'Modelo indisponivel', 'INVALID_MODEL')

    const active = await ProfileAnalysisModel.findActiveByUser(user.id)
    if (active) {
      throw new AppError(409, 'Ja existe uma analise em andamento', 'PROFILE_ANALYSIS_ACTIVE')
    }
    const billing = await BillingCustomerService.requireAvailableCredits(user.id, user.email)
    const jobId = randomUUID()
    const uploaded = await ProfileDocumentService.upload({ file: req.file, jobId, userId: user.id })

    try {
      const job = await ProfileAnalysisModel.createJob({
        id: jobId,
        userId: user.id,
        modelId,
        documentPath: uploaded.documentPath,
        documentName: uploaded.documentName,
        documentMimeType: req.file.mimetype,
        preferences,
        stripeCustomerId: billing.customer.id,
      })
      sendOk(res, { job: mapProfileAnalysisJob(job) }, 202)
    } catch (error) {
      await ProfileDocumentService.remove(uploaded.documentPath)
      const concurrent = await ProfileAnalysisModel.findActiveByUser(user.id)
      if (concurrent) throw new AppError(409, 'Ja existe uma analise em andamento', 'PROFILE_ANALYSIS_ACTIVE')
      throw error
    }
  },

  async list(req: Request, res: Response): Promise<void> {
    const user = requireUser(req)
    const jobs = await ProfileAnalysisModel.listJobsByUser(user.id)
    sendOk(res, { jobs: jobs.map(mapProfileAnalysisJob) })
  },

  async get(req: Request, res: Response): Promise<void> {
    const user = requireUser(req)
    const id = requireIdParam(req)
    sendOk(res, await detailForUser(id, user.id))
  },

  async cancel(req: Request, res: Response): Promise<void> {
    const user = requireUser(req)
    const id = requireIdParam(req)
    const existing = await ProfileAnalysisModel.findJobByUser(id, user.id)
    if (!existing) throw new AppError(404, 'Analise nao encontrada', 'PROFILE_ANALYSIS_NOT_FOUND')
    if (TERMINAL_STATUSES.has(existing.status)) {
      throw new AppError(409, 'Esta analise ja foi encerrada', 'PROFILE_ANALYSIS_TERMINAL')
    }
    const job = await ProfileAnalysisModel.requestCancel(id, user.id, existing.status as 'queued' | 'running' | 'cancel_requested')
    if (!job) throw new AppError(409, 'Esta analise nao pode mais ser cancelada', 'PROFILE_ANALYSIS_TERMINAL')
    sendOk(res, { job: mapProfileAnalysisJob(job) })
  },

  async retry(req: Request, res: Response): Promise<void> {
    const user = requireUser(req)
    const id = requireIdParam(req)
    const previous = await ProfileAnalysisModel.findJobByUser(id, user.id)
    if (!previous) throw new AppError(404, 'Analise nao encontrada', 'PROFILE_ANALYSIS_NOT_FOUND')
    if (!['failed', 'cancelled'].includes(previous.status)) {
      throw new AppError(409, 'Apenas analises falhas ou canceladas podem ser repetidas', 'PROFILE_ANALYSIS_NOT_RETRYABLE')
    }
    if (await ProfileAnalysisModel.findActiveByUser(user.id)) {
      throw new AppError(409, 'Ja existe uma analise em andamento', 'PROFILE_ANALYSIS_ACTIVE')
    }
    const billing = await BillingCustomerService.requireAvailableCredits(user.id, user.email)
    try {
      const job = await ProfileAnalysisModel.createJob({
        id: randomUUID(),
        userId: user.id,
        modelId: previous.model_id,
        documentPath: previous.document_path,
        documentName: previous.document_name,
        documentMimeType: previous.document_mime_type,
        preferences: previous.preferences,
        stripeCustomerId: billing.customer.id,
        retryOfJobId: previous.id,
      })
      sendOk(res, { job: mapProfileAnalysisJob(job) }, 202)
    } catch (error) {
      const concurrent = await ProfileAnalysisModel.findActiveByUser(user.id)
      if (concurrent?.retry_of_job_id === previous.id) {
        sendOk(res, { job: mapProfileAnalysisJob(concurrent) }, 202)
        return
      }
      if (concurrent) throw new AppError(409, 'Ja existe uma analise em andamento', 'PROFILE_ANALYSIS_ACTIVE')
      throw error
    }
  },

  async approve(req: Request, res: Response): Promise<void> {
    const user = requireUser(req)
    const id = requireIdParam(req)
    const detail = await detailForUser(id, user.id)
    if (detail.job.status !== 'succeeded' || !detail.analysis) {
      throw new AppError(409, 'A analise ainda nao possui um rascunho aprovavel', 'PROFILE_ANALYSIS_NOT_APPROVABLE')
    }
    if (detail.analysis.approvedAt) {
      sendOk(res, detail)
      return
    }
    const requested = (req.body as { document?: unknown } | undefined)?.document
    const document = validateProfileDraft(requested ?? detail.analysis.canonicalProfileDraft)
    await ProfileAnalysisModel.approve({ document, jobId: id, userId: user.id })
    sendOk(res, await detailForUser(id, user.id))
  },
}
