import { beforeEach, describe, expect, it } from '@jest/globals'
import { apiClient } from '@/services/apiClient'
import { profileService } from '@/services/profileService'

declare const jest: typeof import('@jest/globals').jest

jest.mock('../services/apiClient', () => ({ apiClient: { get: jest.fn() } }))

describe('profileService', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('le o perfil pela API Node que desembrulha o envelope', async () => {
    jest.mocked(apiClient.get).mockResolvedValue({ profile: null } as never)
    await expect(profileService.get()).resolves.toEqual({ profile: null })
    expect(apiClient.get).toHaveBeenCalledWith('/profile')
  })
})
