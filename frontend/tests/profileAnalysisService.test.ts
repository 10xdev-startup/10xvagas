import { describe, expect, it } from '@jest/globals'
import { apiClient } from '@/services/apiClient'
import { profileAnalysisService } from '@/services/profileAnalysisService'

declare const jest: typeof import('@jest/globals').jest

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    upload: jest.fn(),
  },
}))

describe('profileAnalysisService', () => {
  it('envia documento e preferencias como multipart sem manter request longa', async () => {
    jest.mocked(apiClient.upload).mockResolvedValue({ job: { id: 'job-1' } } as never)
    const document = new File(['curriculo'], 'cv.txt', { type: 'text/plain' })
    const preferences = {
      desiredSkills: [{ name: 'TypeScript', priority: 3 as const }],
      focus: 'backend' as const,
      language: 'pt' as const,
      markets: 'both' as const,
      targetRoles: ['Backend Engineer'],
    }

    await profileAnalysisService.create(document, preferences)

    expect(apiClient.upload).toHaveBeenCalledWith('/profile-analyses', expect.any(FormData))
    const body = jest.mocked(apiClient.upload).mock.calls[0]?.[1]
    expect(body?.get('document')).toBe(document)
    expect(body?.get('preferences')).toBe(JSON.stringify(preferences))
  })

  it('mantem cancelamento, retry e aprovacao em comandos explicitos', async () => {
    jest.mocked(apiClient.post).mockResolvedValue({} as never)

    await profileAnalysisService.cancel('job-1')
    await profileAnalysisService.retry('job-1')
    await profileAnalysisService.approve('job-1', { identity: {} })

    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/profile-analyses/job-1/cancel')
    expect(apiClient.post).toHaveBeenNthCalledWith(2, '/profile-analyses/job-1/retry')
    expect(apiClient.post).toHaveBeenNthCalledWith(3, '/profile-analyses/job-1/approve', { document: { identity: {} } })
  })
})
