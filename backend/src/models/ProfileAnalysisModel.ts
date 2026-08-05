import { supabase } from '@/database/supabase'
import type { ProfileAnalysisEventRow } from '@/types/profileAnalysis'
import type { ProfileAnalysisJobRow } from '@/types/profileAnalysis'
import type { ProfileAnalysisPreferences } from '@/types/profileAnalysis'
import type { ProfileAnalysisRow } from '@/types/profileAnalysis'

const JOB_TABLE = 'profile_analysis_job'
const ANALYSIS_TABLE = 'profile_analysis'
const EVENT_TABLE = 'profile_analysis_event'
const JOB_COLUMNS = 'id, user_id, status, model_id, document_path, document_name, document_mime_type, preferences, progress, current_step, attempt_count, worker_id, claimed_at, lease_expires_at, heartbeat_at, cancel_requested_at, retry_of_job_id, stripe_customer_id, started_at, finished_at, error_code, error_message, created_at, updated_at'
const ANALYSIS_COLUMNS = 'id, user_id, job_id, model_id, prompt_version, canonical_profile_draft, cv_assessment, source_evidence, pending_questions, approved_at, created_at, updated_at'
const EVENT_COLUMNS = 'id, user_id, job_id, event_key, event_type, stage, message, progress, metadata, created_at'
const ACTIVE_STATUSES = ['queued', 'running', 'cancel_requested'] as const

export interface CreateProfileAnalysisJobInput {
  id: string
  userId: string
  modelId: string
  documentPath: string
  documentName: string
  documentMimeType: string
  preferences: ProfileAnalysisPreferences
  stripeCustomerId: string
  retryOfJobId?: string
}

export const ProfileAnalysisModel = {
  async createJob(input: CreateProfileAnalysisJobInput): Promise<ProfileAnalysisJobRow> {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from(JOB_TABLE)
      .insert({
        id: input.id,
        user_id: input.userId,
        status: 'queued',
        model_id: input.modelId,
        document_path: input.documentPath,
        document_name: input.documentName,
        document_mime_type: input.documentMimeType,
        preferences: input.preferences,
        progress: 0,
        current_step: 'Aguardando processamento',
        attempt_count: 0,
        retry_of_job_id: input.retryOfJobId ?? null,
        stripe_customer_id: input.stripeCustomerId,
        created_at: now,
        updated_at: now,
      })
      .select(JOB_COLUMNS)
      .single()
    if (error) throw new Error(error.message)
    return data as ProfileAnalysisJobRow
  },

  async findActiveByUser(userId: string): Promise<ProfileAnalysisJobRow | null> {
    const { data, error } = await supabase
      .from(JOB_TABLE)
      .select(JOB_COLUMNS)
      .eq('user_id', userId)
      .in('status', [...ACTIVE_STATUSES])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as ProfileAnalysisJobRow | null) ?? null
  },

  async findJobByUser(id: string, userId: string): Promise<ProfileAnalysisJobRow | null> {
    const { data, error } = await supabase
      .from(JOB_TABLE)
      .select(JOB_COLUMNS)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as ProfileAnalysisJobRow | null) ?? null
  },

  async listJobsByUser(userId: string): Promise<ProfileAnalysisJobRow[]> {
    const { data, error } = await supabase
      .from(JOB_TABLE)
      .select(JOB_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) throw new Error(error.message)
    return (data as ProfileAnalysisJobRow[] | null) ?? []
  },

  async findAnalysisByJob(jobId: string, userId: string): Promise<ProfileAnalysisRow | null> {
    const { data, error } = await supabase
      .from(ANALYSIS_TABLE)
      .select(ANALYSIS_COLUMNS)
      .eq('job_id', jobId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as ProfileAnalysisRow | null) ?? null
  },

  async listEventsByJob(jobId: string, userId: string): Promise<ProfileAnalysisEventRow[]> {
    const { data, error } = await supabase
      .from(EVENT_TABLE)
      .select(EVENT_COLUMNS)
      .eq('job_id', jobId)
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .limit(100)
    if (error) throw new Error(error.message)
    return (data as ProfileAnalysisEventRow[] | null) ?? []
  },

  async requestCancel(id: string, userId: string, status: 'queued' | 'running' | 'cancel_requested'): Promise<ProfileAnalysisJobRow | null> {
    const now = new Date().toISOString()
    if (status === 'cancel_requested') {
      return ProfileAnalysisModel.findJobByUser(id, userId)
    }
    const patch = status === 'queued'
      ? {
          current_step: null,
          cancel_requested_at: now,
          finished_at: now,
          progress: 100,
          status: 'cancelled',
          updated_at: now,
        }
      : { status: 'cancel_requested', cancel_requested_at: now, updated_at: now }
    const { data, error } = await supabase
      .from(JOB_TABLE)
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', status)
      .select(JOB_COLUMNS)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as ProfileAnalysisJobRow | null) ?? null
  },

  async approve(params: { document: Record<string, unknown>; jobId: string; userId: string }): Promise<ProfileAnalysisRow> {
    const { data, error } = await supabase.rpc('approve_profile_analysis', {
      p_document: params.document,
      p_job_id: params.jobId,
      p_user_id: params.userId,
    })
    if (error) throw new Error(error.message)
    const row = Array.isArray(data) ? data[0] : data
    if (!row) throw new Error('Analise nao encontrada para aprovacao')
    return row as ProfileAnalysisRow
  },
}
