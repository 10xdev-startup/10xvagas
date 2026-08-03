import type { RadarJob } from '@/types/job'

/**
 * Unica forma de construir URL de vaga. Nao repetir `slug ?? id` em call site:
 * um unico lugar que reconstroi caminho na mao ja faz a URL regredir ao id.
 */

export function jobPath(job: Pick<RadarJob, 'publicId'>): string {
  return `/vaga/${job.publicId}`
}

/** URL absoluta — para copiar, compartilhar ou persistir fora da aplicacao. */
export function jobShareUrl(job: Pick<RadarJob, 'publicId'>, origin: string): string {
  return new URL(jobPath(job), origin).toString()
}
