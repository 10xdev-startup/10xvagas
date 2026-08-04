import { beforeEach, describe, expect, it } from '@jest/globals'
import type { MockedFunction } from 'jest-mock'
import { apiClient } from '@/services/apiClient'
import { jobService } from '@/services/jobService'

declare const jest: typeof import('@jest/globals').jest

jest.mock('../services/apiClient', () => ({ apiClient: { get: jest.fn() } }))

describe('jobService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('lista vagas pelo apiClient que desembrulha o envelope', async () => {
    const get = apiClient.get as MockedFunction<typeof apiClient.get>
    get.mockResolvedValue({ collectedAt: null, jobs: [], pagination: { hasMore: false, limit: 100, offset: 0, total: 0 }, sources: [] } as never)

    await jobService.list()

    expect(get).toHaveBeenCalledWith('/jobs?limit=100&offset=0')
  })

  it('codifica slug antes de buscar o detalhe', async () => {
    const get = apiClient.get as MockedFunction<typeof apiClient.get>
    get.mockResolvedValue({} as never)

    await jobService.getById('backend engineer-abc123')

    expect(get).toHaveBeenCalledWith('/jobs/backend%20engineer-abc123')
  })
})
