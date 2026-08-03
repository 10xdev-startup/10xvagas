export type RadarJob = {
  id: string
  publicId: string
  market: 'brazil' | 'international'
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
  status: 'matched' | 'new'
}

export type SourceStatus = {
  id: string
  label: string
  mode: 'automatic' | 'assisted'
  status: 'ok' | 'error' | 'assisted' | 'unsupported'
  count: number
  lastRunAt: string | null
  error: string | null
}

export type JobListResponse = {
  collectedAt: string | null
  jobs: RadarJob[]
  sources: SourceStatus[]
}
