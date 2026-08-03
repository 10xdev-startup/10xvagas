import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { RadarJob, SourceStatus } from '@/types/job'
import { buildPublicId } from '@/lib/urlSlug'

export type { RadarJob, SourceStatus } from '@/types/job'

export type ExperimentMatch = {
  rank: number
  id: string
  market: 'brazil' | 'international'
  company: string
  title: string
  source_url: string
  score: number
  excluded: boolean
  reasons: string[]
  gaps: string[]
}

export type ExperimentJob = {
  id: string
  source: string
  source_url: string
  summary: string
  location: { display: string; remote: boolean }
  employment_type: string
  salary_original: { raw: string } | null
  required_skills: string[]
  preferred_skills: string[]
}

export type ExperimentDashboardData = {
  collectedAt: string
  jobsCount: number
  brazilCount: number
  internationalCount: number
  strongMatchesCount: number
  pendingFactsCount: number
  desiredSkills: string[]
  radarJobs: RadarJob[]
  sources: SourceStatus[]
  pendingQuestions: string[]
}

type ProfileDocument = {
  skills_desired: Array<{ name: string; priority: number }>
  facts_pending_confirmation: Array<{ question_pt: string }>
}

type JobsDocument = {
  collected_at: string
  jobs: ExperimentJob[]
}

type RankingDocument = {
  ranking: ExperimentMatch[]
}

type LiveJob = {
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
  market: 'brazil' | 'international'
}

type LiveJobsDocument = {
  collected_at: string
  sources: SourceStatus[]
  jobs: LiveJob[]
}

async function readJson<T>(relativePath: string): Promise<T> {
  const repositoryRoot = path.resolve(process.cwd(), '..')
  const content = await readFile(path.join(repositoryRoot, relativePath), 'utf-8')
  return JSON.parse(content) as T
}

async function readLiveJobs(): Promise<LiveJobsDocument> {
  try {
    return await readJson<LiveJobsDocument>('engine/sources/output/live-jobs.json')
  } catch {
    return { collected_at: '', sources: [], jobs: [] }
  }
}

function canonicalUrl(value: string): string {
  return value.trim().replace(/\/$/, '').toLocaleLowerCase('en-US')
}

export async function getExperimentDashboardData(): Promise<ExperimentDashboardData> {
  const [profile, jobsDocument, rankingDocument, liveDocument] = await Promise.all([
    readJson<ProfileDocument>('engine/experiment/data/canonical-profile.json'),
    readJson<JobsDocument>('engine/experiment/data/jobs.json'),
    readJson<RankingDocument>('engine/experiment/output/system-ranking.json'),
    readLiveJobs(),
  ])
  const jobsById = new Map(jobsDocument.jobs.map((job) => [job.id, job]))
  const liveByUrl = new Map(liveDocument.jobs.map((job) => [canonicalUrl(job.source_url), job]))
  const matchedJobs = rankingDocument.ranking
    .filter((match) => !match.excluded)
    .flatMap<RadarJob>((match) => {
      const job = jobsById.get(match.id)
      if (!job) return []
      const liveJob = liveByUrl.get(canonicalUrl(match.source_url))
      return [{
        id: match.id,
        publicId: buildPublicId(match.id, [match.title, match.company]),
        market: match.market,
        company: match.company,
        title: match.title,
        source: liveJob?.source ?? job.source.toLocaleLowerCase('en-US'),
        sourceLabel: liveJob?.source_label ?? job.source,
        sourceUrl: match.source_url,
        applyUrl: liveJob?.apply_url ?? null,
        description: liveJob?.description || job.summary,
        location: liveJob?.location ?? job.location.display,
        workplaceType: liveJob?.workplace_type ?? (job.location.remote ? 'remote' : 'hybrid'),
        employmentType: liveJob?.employment_type ?? job.employment_type,
        salary: liveJob?.salary_raw ?? job.salary_original?.raw ?? null,
        publishedAt: liveJob?.published_at ?? null,
        score: match.score,
        rank: match.rank,
        reasons: match.reasons,
        gaps: match.gaps,
        skills: job.required_skills,
        status: 'matched',
      }]
    })
  const matchedUrls = new Set(matchedJobs.map((job) => canonicalUrl(job.sourceUrl)))
  const newJobs = liveDocument.jobs
    .filter((job) => !matchedUrls.has(canonicalUrl(job.source_url)))
    .map<RadarJob>((job) => ({
      id: `${job.source}:${job.external_id}`,
      publicId: buildPublicId(`${job.source}:${job.external_id}`, [job.title, job.company]),
      market: job.market,
      company: job.company,
      title: job.title,
      source: job.source,
      sourceLabel: job.source_label,
      sourceUrl: job.source_url,
      applyUrl: job.apply_url,
      description: job.description,
      location: job.location,
      workplaceType: job.workplace_type,
      employmentType: job.employment_type,
      salary: job.salary_raw,
      publishedAt: job.published_at,
      score: null,
      rank: null,
      reasons: [],
      gaps: [],
      skills: [],
      status: 'new',
    }))
  const radarJobs = [...matchedJobs, ...newJobs]

  return {
    collectedAt: liveDocument.collected_at || jobsDocument.collected_at,
    jobsCount: radarJobs.length,
    brazilCount: radarJobs.filter((job) => job.market === 'brazil').length,
    internationalCount: radarJobs.filter((job) => job.market === 'international').length,
    strongMatchesCount: matchedJobs.filter((job) => (job.score ?? 0) >= 80).length,
    pendingFactsCount: profile.facts_pending_confirmation.length,
    desiredSkills: profile.skills_desired
      .toSorted((first, second) => second.priority - first.priority)
      .slice(0, 10)
      .map((skill) => skill.name),
    radarJobs,
    sources: liveDocument.sources,
    pendingQuestions: profile.facts_pending_confirmation
      .slice(0, 4)
      .map((fact) => fact.question_pt),
  }
}
