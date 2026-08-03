import { supabase } from '@/database/supabase'
import type { JobMatchRow, JobRow, RadarJob, ResolveJobIdResult } from '@/types/job'
import { rowToRadarJob } from '@/types/job'
import { extractSlugPrefix, slugPrefixToUUIDRange } from '@/utils/slugify'

const TABLE = 'job'
const MATCH_TABLE = 'job_match'
const COLUMNS = 'id, external_id, source, source_label, title, company, source_url, apply_url, description, location, workplace_type, employment_type, published_at, salary_raw, market, first_seen_at, last_seen_at, created_at, updated_at'
const MATCH_COLUMNS = 'user_id, job_id, score, rank, excluded, reasons, gaps, skills, matched_at, updated_at'

/** Acesso ao catalogo global e aos matches privados. Toda query de match inclui `user_id`. */
export const JobModel = {
  async listByUser(userId: string): Promise<{ jobs: RadarJob[]; collectedAt: string | null }> {
    const [{ data: jobsData, error: jobsError }, { data: matchesData, error: matchesError }] = await Promise.all([
      supabase.from(TABLE).select(COLUMNS).order('last_seen_at', { ascending: false }),
      supabase.from(MATCH_TABLE).select(MATCH_COLUMNS).eq('user_id', userId),
    ])
    if (jobsError) throw new Error(jobsError.message)
    if (matchesError) throw new Error(matchesError.message)

    const rows = (jobsData as JobRow[] | null) ?? []
    const matches = (matchesData as JobMatchRow[] | null) ?? []
    const matchesByJobId = new Map(matches.map((match) => [match.job_id, match]))

    const jobs = rows
      .filter((row) => !matchesByJobId.get(row.id)?.excluded)
      .map((row) => rowToRadarJob(row, matchesByJobId.get(row.id) ?? null))
      .sort((first, second) => {
        if (first.rank !== null && second.rank !== null) return first.rank - second.rank
        if (first.rank !== null) return -1
        if (second.rank !== null) return 1
        return 0
      })
    const collectedAt = rows.map((row) => row.last_seen_at).sort().at(-1) ?? null
    return { jobs, collectedAt }
  },

  async findByIdForUser(userId: string, id: string): Promise<RadarJob | null> {
    const { data: jobData, error: jobError } = await supabase
      .from(TABLE)
      .select(COLUMNS)
      .eq('id', id)
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
