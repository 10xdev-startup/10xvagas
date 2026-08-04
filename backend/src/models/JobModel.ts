import { supabase } from '@/database/supabase'
import type { JobListRow, JobListRpcResult, JobMatchRow, JobRow, RadarJob, ResolveJobIdResult, SourceRunRow, SourceStatus } from '@/types/job'
import { rowToRadarJob, sourceRunsToStatuses } from '@/types/job'
import { extractSlugPrefix, slugPrefixToUUIDRange } from '@/utils/slugify'

const TABLE = 'job'
const MATCH_TABLE = 'job_match'
const SOURCE_RUN_TABLE = 'source_run'
const COLUMNS = 'id, external_id, source, source_label, title, company, source_url, apply_url, description, location, workplace_type, employment_type, published_at, salary_raw, market, first_seen_at, last_seen_at, created_at, updated_at'
const LIST_COLUMNS = 'id, external_id, source, source_label, title, company, source_url, apply_url, location, workplace_type, employment_type, published_at, salary_raw, market, first_seen_at, last_seen_at, created_at, updated_at'
const MATCH_COLUMNS = 'user_id, job_id, score, rank, excluded, reasons, gaps, skills, matched_at, updated_at'
const SOURCE_RUN_COLUMNS = 'source_id, source_label, mode, status, job_count, error_message, collected_at'

function rpcRowToRadarJob(row: JobListRpcResult['jobs'][number]): RadarJob {
  const match: JobMatchRow | null = row.match_id
    ? {
        excluded: false,
        gaps: row.gaps ?? [],
        job_id: row.id,
        matched_at: row.matched_at ?? row.updated_at,
        rank: row.rank,
        reasons: row.reasons ?? [],
        score: row.score,
        skills: row.skills ?? [],
        updated_at: row.updated_at,
        user_id: '',
      }
    : null
  return rowToRadarJob(row, match)
}

function isMissingListRpc(error: { code?: string; message: string }): boolean {
  return error.code === 'PGRST202' || error.message.includes('list_jobs_for_user')
}

async function listByUserFallback(userId: string, options: { limit: number; offset: number }): Promise<{
  collectedAt: string | null
  jobs: RadarJob[]
  total: number
}> {
  const pageSize = 1000
  const rows: JobListRow[] = []
  const matches: JobMatchRow[] = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(LIST_COLUMNS)
      .eq('is_active', true)
      .order('last_seen_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(error.message)
    const page = (data as JobListRow[] | null) ?? []
    rows.push(...page)
    if (page.length < pageSize) break
  }
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(MATCH_TABLE)
      .select(MATCH_COLUMNS)
      .eq('user_id', userId)
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(error.message)
    const page = (data as JobMatchRow[] | null) ?? []
    matches.push(...page)
    if (page.length < pageSize) break
  }
  const matchesByJobId = new Map(matches.map((match) => [match.job_id, match]))
  const ordered = rows
    .filter((row) => !matchesByJobId.get(row.id)?.excluded)
    .map((row) => rowToRadarJob(row, matchesByJobId.get(row.id) ?? null))
    .sort((first, second) => {
      if (first.rank !== null && second.rank !== null) return first.rank - second.rank
      if (first.rank !== null) return -1
      if (second.rank !== null) return 1
      return 0
    })
  return {
    collectedAt: rows.map((row) => row.last_seen_at).sort().at(-1) ?? null,
    jobs: ordered.slice(options.offset, options.offset + options.limit),
    total: ordered.length,
  }
}

/** Acesso ao catalogo global e aos matches privados. Toda query de match inclui `user_id`. */
export const JobModel = {
  async listByUser(userId: string, options: { limit: number; offset: number }): Promise<{
    jobs: RadarJob[]
    collectedAt: string | null
    sources: SourceStatus[]
    total: number
  }> {
    const [jobsResult, sourcesResult] = await Promise.all([
      supabase.rpc('list_jobs_for_user', {
        p_limit: options.limit,
        p_offset: options.offset,
        p_user_id: userId,
      }),
      supabase.from(SOURCE_RUN_TABLE).select(SOURCE_RUN_COLUMNS).order('collected_at', { ascending: false }).limit(100),
    ])
    const { data: jobsData, error: jobsError } = jobsResult
    const { data: sourcesData, error: sourcesError } = sourcesResult
    if (sourcesError) throw new Error(sourcesError.message)

    let jobs: RadarJob[]
    let total: number
    let jobsCollectedAt: string | null
    if (jobsError) {
      if (!isMissingListRpc(jobsError)) throw new Error(jobsError.message)
      console.warn('[JobModel] RPC list_jobs_for_user ausente; usando fallback paginado')
      const fallback = await listByUserFallback(userId, options)
      jobs = fallback.jobs
      total = fallback.total
      jobsCollectedAt = fallback.collectedAt
    } else {
      const result = (jobsData as JobListRpcResult | null) ?? { jobs: [], total: 0 }
      jobs = result.jobs.map(rpcRowToRadarJob)
      total = result.total
      jobsCollectedAt = result.jobs.map((row) => row.last_seen_at).sort().at(-1) ?? null
    }
    const sourceRuns = (sourcesData as SourceRunRow[] | null) ?? []
    const sources = sourceRunsToStatuses(sourceRuns)
    const collectedAt = sources.map((source) => source.lastRunAt).filter((value): value is string => value !== null).sort().at(-1)
      ?? jobsCollectedAt
      ?? null
    return { jobs, collectedAt, sources, total }
  },

  async findByIdForUser(userId: string, id: string): Promise<RadarJob | null> {
    const { data: jobData, error: jobError } = await supabase
      .from(TABLE)
      .select(COLUMNS)
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle()
    if (jobError) throw new Error(jobError.message)
    if (!jobData) return null

    const { data: matchData, error: matchError } = await supabase
      .from(MATCH_TABLE)
      .select(MATCH_COLUMNS)
      .eq('user_id', userId)
      .eq('job_id', id)
      .maybeSingle()
    if (matchError) throw new Error(matchError.message)

    const match = matchData as JobMatchRow | null
    if (match?.excluded) return null
    return rowToRadarJob(jobData as JobRow, match)
  },

  async resolveId(slug: string): Promise<ResolveJobIdResult> {
    const prefix = extractSlugPrefix(slug)
    if (!prefix) return { status: 'not_found' }
    const { min, max } = slugPrefixToUUIDRange(prefix)
    const { data, error } = await supabase
      .from(TABLE)
      .select('id')
      .eq('is_active', true)
      .gte('id', min)
      .lte('id', max)
      .limit(2)
    if (error) throw new Error(error.message)

    const candidates = ((data as Array<{ id: string }> | null) ?? []).map((row) => row.id)
    if (candidates.length === 1) return { status: 'resolved', id: candidates[0] as string }
    if (candidates.length > 1) return { status: 'ambiguous', ids: candidates }
    return { status: 'not_found' }
  },
}
