export const PROFILE_ANALYSIS_STATUSES = [
  'queued',
  'running',
  'cancel_requested',
  'cancelled',
  'succeeded',
  'failed',
] as const

export const PROFILE_ANALYSIS_FOCUSES = ['backend', 'frontend', 'full_stack', 'ai'] as const
export const PROFILE_ANALYSIS_LANGUAGES = ['pt', 'en'] as const
export const PROFILE_ANALYSIS_MARKETS = ['brazil', 'international', 'both'] as const

export type ProfileAnalysisStatus = typeof PROFILE_ANALYSIS_STATUSES[number]
export type ProfileAnalysisFocus = typeof PROFILE_ANALYSIS_FOCUSES[number]
export type ProfileAnalysisLanguage = typeof PROFILE_ANALYSIS_LANGUAGES[number]
export type ProfileAnalysisMarket = typeof PROFILE_ANALYSIS_MARKETS[number]
export type ProfileAnalysisEventType = 'cancelled' | 'completed' | 'failed' | 'stage' | 'tool_call' | 'tool_result'

export interface DesiredSkillInput {
  name: string
  priority: 1 | 2 | 3
}

export interface ProfileAnalysisPreferences {
  desiredSkills: DesiredSkillInput[]
  focus: ProfileAnalysisFocus
  language: ProfileAnalysisLanguage
  markets: ProfileAnalysisMarket
  targetRoles: string[]
}

export interface ProfileAnalysisJobRow {
  id: string
  user_id: string
  status: ProfileAnalysisStatus
  model_id: string
  document_path: string
  document_name: string
  document_mime_type: string
  preferences: ProfileAnalysisPreferences
  progress: number
  current_step: string | null
  attempt_count: number
  worker_id: string | null
  claimed_at: string | null
  lease_expires_at: string | null
  heartbeat_at: string | null
  cancel_requested_at: string | null
  retry_of_job_id: string | null
  stripe_customer_id: string
  started_at: string | null
  finished_at: string | null
  error_code: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface ProfileAnalysisRow {
  id: string
  user_id: string
  job_id: string
  model_id: string
  prompt_version: string
  canonical_profile_draft: Record<string, unknown>
  cv_assessment: Record<string, unknown>
  source_evidence: unknown[]
  pending_questions: unknown[]
  approved_at: string | null
  created_at: string
  updated_at: string
}

export interface ProfileAnalysisEventRow {
  id: number
  user_id: string
  job_id: string
  event_key: string
  event_type: ProfileAnalysisEventType
  stage: string
  message: string
  progress: number
  metadata: Record<string, unknown>
  created_at: string
}

export interface ProfileAnalysisJob {
  id: string
  status: ProfileAnalysisStatus
  modelId: string
  documentName: string
  documentMimeType: string
  preferences: ProfileAnalysisPreferences
  progress: number
  currentStep: string | null
  attemptCount: number
  cancelRequestedAt: string | null
  retryOfJobId: string | null
  startedAt: string | null
  finishedAt: string | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface ProfileAnalysis {
  id: string
  jobId: string
  modelId: string
  promptVersion: string
  canonicalProfileDraft: Record<string, unknown>
  cvAssessment: Record<string, unknown>
  sourceEvidence: unknown[]
  pendingQuestions: unknown[]
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ProfileAnalysisEvent {
  id: number
  eventKey: string
  eventType: ProfileAnalysisEventType
  stage: string
  message: string
  progress: number
  metadata: Record<string, unknown>
  createdAt: string
}

export interface ProfileAnalysisDetail {
  analysis: ProfileAnalysis | null
  events: ProfileAnalysisEvent[]
  job: ProfileAnalysisJob
}

export function mapProfileAnalysisJob(row: ProfileAnalysisJobRow): ProfileAnalysisJob {
  return {
    id: row.id,
    status: row.status,
    modelId: row.model_id,
    documentName: row.document_name,
    documentMimeType: row.document_mime_type,
    preferences: row.preferences,
    progress: row.progress,
    currentStep: row.current_step,
    attemptCount: row.attempt_count,
    cancelRequestedAt: row.cancel_requested_at,
    retryOfJobId: row.retry_of_job_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapProfileAnalysis(row: ProfileAnalysisRow): ProfileAnalysis {
  return {
    id: row.id,
    jobId: row.job_id,
    modelId: row.model_id,
    promptVersion: row.prompt_version,
    canonicalProfileDraft: row.canonical_profile_draft,
    cvAssessment: row.cv_assessment,
    sourceEvidence: row.source_evidence,
    pendingQuestions: row.pending_questions,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapProfileAnalysisEvent(row: ProfileAnalysisEventRow): ProfileAnalysisEvent {
  return {
    id: row.id,
    eventKey: row.event_key,
    eventType: row.event_type,
    stage: row.stage,
    message: row.message,
    progress: row.progress,
    metadata: row.metadata,
    createdAt: row.created_at,
  }
}
