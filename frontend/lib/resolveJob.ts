import 'server-only'

import type { RadarJob } from '@/types/job'
import { getExperimentDashboardData } from '@/lib/experiment'
import { parsePublicId } from '@/lib/urlSlug'

/**
 * Ponto unico onde URL vira identidade interna. Quem chama recebe a vaga
 * resolvida — nunca o parametro cru da rota, para nenhuma query seguinte usar o
 * identificador publico por acidente.
 */
export async function resolveJobByPublicId(publicId: string): Promise<RadarJob | null> {
  // 1. Gramatica inteira antes de qualquer leitura de dado.
  const parsed = parsePublicId(publicId)
  if (!parsed) return null

  const { radarJobs } = await getExperimentDashboardData()

  // 2. Todos os candidatos, nao o primeiro: parar no primeiro esconde colisao.
  const candidates = radarJobs.filter(
    (job) => job.publicId === parsed.suffix || job.publicId.endsWith(`-${parsed.suffix}`),
  )

  // 3. Resolve so quando a politica do plano e satisfeita exatamente.
  if (candidates.length === 1) return candidates[0] ?? null

  if (candidates.length > 1) {
    console.error('[resolveJobByPublicId] sufixo ambiguo', {
      suffix: parsed.suffix,
      ids: candidates.map((job) => job.id),
    })
  }

  // 4. Ambiguo e inexistente convergem para o mesmo resultado.
  return null
}
