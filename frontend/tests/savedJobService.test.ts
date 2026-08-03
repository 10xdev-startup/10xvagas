import { beforeEach, describe, expect, it } from '@jest/globals'
import type { MockedFunction } from 'jest-mock'
import { apiClient } from '@/services/apiClient'
import { getJobKey, savedJobService } from '@/services/savedJobService'
import type { RadarJob } from '@/types/job'

declare const jest: typeof import('@jest/globals').jest

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}))

const job: RadarJob = {
  id: 'experiment-1', publicId: 'full-stack-10xdev-cccccccccc', market: 'brazil', company: '10xDev', title: 'Full Stack', source: 'Lever', sourceLabel: 'Lever',
  sourceUrl: 'https://jobs.example.com/ABC/', applyUrl: null, description: 'TypeScript', location: 'Belo Horizonte, MG',
  workplaceType: 'hybrid', employmentType: 'clt', salary: null, publishedAt: null, score: 90, rank: 1,
  reasons: ['stack'], gaps: [], skills: ['TypeScript'], status: 'matched',
}

describe('savedJobService', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('gera chave estavel independente do id do experimento', () => {
    const reranked: RadarJob = { ...job, id: 'outro-id' }
    expect(getJobKey(job)).toBe('lever:https://jobs.example.com/abc')
    expect(getJobKey(reranked)).toBe(getJobKey(job))
  })

  it('salva snapshot sem id pelo apiClient', async () => {
    const post = apiClient.post as MockedFunction<typeof apiClient.post>
    post.mockResolvedValue({} as never)
    await savedJobService.save(job)
    expect(post).toHaveBeenCalledWith('/saved-jobs', {
      jobKey: getJobKey(job),
      snapshot: expect.not.objectContaining({ id: expect.anything() }),
    })
  })

  it('codifica a chave ao remover', async () => {
    const remove = apiClient.delete as MockedFunction<typeof apiClient.delete>
    remove.mockResolvedValue({ jobKey: getJobKey(job), removed: true } as never)
    await savedJobService.remove(job)
    expect(remove).toHaveBeenCalledWith(`/saved-jobs/${encodeURIComponent(getJobKey(job))}`)
  })
})
