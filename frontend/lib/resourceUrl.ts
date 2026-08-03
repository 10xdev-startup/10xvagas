import type { RadarJob } from '@/types/job'

/** O frontend apenas usa o identificador publico entregue pelo backend. */
export function jobPath(job: Pick<RadarJob, 'publicId'>): string {
  return `/vaga/${job.publicId}`
}

export function jobShareUrl(job: Pick<RadarJob, 'publicId'>, origin: string): string {
  return new URL(jobPath(job), origin).toString()
}
