import { makeSlug } from '@/utils/slugify'

export type JobMarket = 'brazil' | 'international'
export type JobRadarStatus = 'matched' | 'new'

export interface JobRow {
  id: string
  external_id: string
  source: string
  source_label: string
  title: string
  company: string
  source_url: string
  apply_url: string | null
  description: string
  location: string
  workplace_type: string
  employment_type: string | null
  published_at: string | null
  salary_raw: string | null
  market: JobMarket
  first_seen_at: string
  last_seen_at: string
  created_at: string
  updated_at: string
}

export interface JobMatchRow {
  user_id: string
  job_id: string
  score: number | null
  rank: number | null
  excluded: boolean
  reasons: string[]
  gaps: string[]
  skills: string[]
  matched_at: string
  updated_at: string
}

export interface RadarJob {
  id: string
  publicId: string
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

export interface SourceStatus {
  id: string
  label: string
  mode: 'automatic' | 'assisted'
  status: 'ok' | 'error' | 'assisted' | 'unsupported'
  count: number
}

export interface JobListResponse {
  collectedAt: string | null
  jobs: RadarJob[]
  sources: SourceStatus[]
}

export type ResolveJobIdResult =
  | { status: 'resolved'; id: string }
  | { status: 'not_found' }
  | { status: 'ambiguous'; ids: string[] }

export function rowToRadarJob(row: JobRow, match: JobMatchRow | null): RadarJob {
  return {
    id: row.id,
    publicId: makeSlug(`${row.title} ${row.company}`, row.id),
    market: row.market,
    company: row.company,
    title: row.title,
    source: row.source,
    sourceLabel: row.source_label,
    sourceUrl: row.source_url,
    applyUrl: row.apply_url,
    description: row.description,
    location: row.location,
    workplaceType: row.workplace_type,
    employmentType: row.employment_type,
    salary: row.salary_raw,
    publishedAt: row.published_at,
    score: match?.score ?? null,
    rank: match?.rank ?? null,
    reasons: match?.reasons ?? [],
    gaps: match?.gaps ?? [],
    skills: match?.skills ?? [],
    status: match ? 'matched' : 'new',
  }
}
