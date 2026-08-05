import { apiClient } from '@/services/apiClient'
import type { CanonicalProfile } from '@/types/profile'

export const profileService = {
  get: (): Promise<{ profile: CanonicalProfile | null }> => apiClient.get('/profile'),
}
