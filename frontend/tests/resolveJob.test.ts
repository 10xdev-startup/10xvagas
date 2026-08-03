import { beforeEach, describe, expect, it } from '@jest/globals'
import type { RadarJob } from '@/types/job'

declare const jest: typeof import('@jest/globals').jest

const getExperimentDashboardData = jest.fn<() => Promise<{ radarJobs: RadarJob[] }>>()

jest.mock('../lib/experiment', () => ({ getExperimentDashboardData }))

function job(id: string, publicId: string): RadarJob {
  return {
    id, publicId, market: 'brazil', company: 'Acme', title: 'Dev', source: 'lever', sourceLabel: 'Lever',
    sourceUrl: 'https://example.com/1', applyUrl: null, description: '', location: 'Remoto',
    workplaceType: 'remote', employmentType: null, salary: null, publishedAt: null,
    score: null, rank: null, reasons: [], gaps: [], skills: [], status: 'new',
  }
}

describe('resolveJobByPublicId', () => {
  beforeEach(() => {
    jest.resetModules()
    getExperimentDashboardData.mockReset()
  })

  it('resolve a vaga quando ha exatamente um candidato', async () => {
    getExperimentDashboardData.mockResolvedValue({ radarJobs: [job('BR-1', 'dev-acme-a1b2c3d4e5')] })
    const { resolveJobByPublicId } = await import('@/lib/resolveJob')
    await expect(resolveJobByPublicId('dev-acme-a1b2c3d4e5')).resolves.toMatchObject({ id: 'BR-1' })
  })

  it('resolve mesmo com decorativo divergente — o sufixo carrega a identidade', async () => {
    getExperimentDashboardData.mockResolvedValue({ radarJobs: [job('BR-1', 'dev-acme-a1b2c3d4e5')] })
    const { resolveJobByPublicId } = await import('@/lib/resolveJob')
    await expect(resolveJobByPublicId('titulo-renomeado-a1b2c3d4e5')).resolves.toMatchObject({ id: 'BR-1' })
  })

  it('NUNCA abre registro arbitrario quando o sufixo e ambiguo', async () => {
    getExperimentDashboardData.mockResolvedValue({
      radarJobs: [job('BR-1', 'dev-acme-a1b2c3d4e5'), job('BR-2', 'outra-vaga-a1b2c3d4e5')],
    })
    const { resolveJobByPublicId } = await import('@/lib/resolveJob')
    await expect(resolveJobByPublicId('dev-acme-a1b2c3d4e5')).resolves.toBeNull()
  })

  it('nao le dado nenhum quando a entrada e malformada', async () => {
    const { resolveJobByPublicId } = await import('@/lib/resolveJob')
    await expect(resolveJobByPublicId('malformado')).resolves.toBeNull()
    await expect(resolveJobByPublicId('563cb60e-1471-4c8d-865c-d21eec081645')).resolves.toBeNull()
    expect(getExperimentDashboardData).not.toHaveBeenCalled()
  })

  it('devolve null quando nao existe candidato', async () => {
    getExperimentDashboardData.mockResolvedValue({ radarJobs: [job('BR-1', 'dev-acme-a1b2c3d4e5')] })
    const { resolveJobByPublicId } = await import('@/lib/resolveJob')
    await expect(resolveJobByPublicId('dev-acme-ffffffffff')).resolves.toBeNull()
  })

  it('sufixo puro nao casa por sufixo parcial de outro publicId', async () => {
    getExperimentDashboardData.mockResolvedValue({ radarJobs: [job('BR-1', 'dev-acme-a1b2c3d4e5')] })
    const { resolveJobByPublicId } = await import('@/lib/resolveJob')
    await expect(resolveJobByPublicId('b2c3d4e5aa')).resolves.toBeNull()
  })
})
