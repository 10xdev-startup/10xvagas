export type JobMarket = 'brazil' | 'international'

export type JobRadarStatus = 'matched' | 'new'

/** Snapshot normalizado da vaga no instante em que o usuario a salvou. */
export interface SavedJobSnapshot {
  market: JobMarket
  company: string
  title: string
  source: string
  sourceLabel: string
  sourceUrl: string
  applyUrl: string | null
  description: string
  location: string
  workplaceType: string
  employmentType: string | null
  salary: string | null
  publishedAt: string | null
  score: number | null
  rank: number | null
  reasons: string[]
  gaps: string[]
  skills: string[]
  status: JobRadarStatus
}

/** Linha da tabela `saved_job` no Supabase. */
export interface SavedJobRow {
  id: string
  user_id: string
  job_key: string
  snapshot: SavedJobSnapshot
  created_at: string
  updated_at: string
}

/** Vaga salva exposta pela API. */
export interface SavedJob {
  id: string
  jobKey: string
  snapshot: SavedJobSnapshot
  savedAt: string
  updatedAt: string
}

export function rowToSavedJob(row: SavedJobRow): SavedJob {
  return {
    id: row.id,
    jobKey: row.job_key,
    snapshot: row.snapshot,
    savedAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
