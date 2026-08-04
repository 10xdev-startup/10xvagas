import { apiClient } from '@/services/apiClient'
import type { ProfileAnalysisDetail, ProfileAnalysisJob, ProfileAnalysisPreferences } from '@/types/profileAnalysis'

export const profileAnalysisService = {
  create(document: File, preferences: ProfileAnalysisPreferences): Promise<{ job: ProfileAnalysisJob }> {
    const formData = new FormData()
    formData.append('document', document)
    formData.append('preferences', JSON.stringify(preferences))
    return apiClient.upload('/profile-analyses', formData)
  },
  list: (): Promise<{ jobs: ProfileAnalysisJob[] }> => apiClient.get('/profile-analyses'),
  get: (id: string): Promise<ProfileAnalysisDetail> => apiClient.get(`/profile-analyses/${id}`),
  cancel: (id: string): Promise<{ job: ProfileAnalysisJob }> => apiClient.post(`/profile-analyses/${id}/cancel`),
  retry: (id: string): Promise<{ job: ProfileAnalysisJob }> => apiClient.post(`/profile-analyses/${id}/retry`),
  approve: (id: string, document: Record<string, unknown>): Promise<ProfileAnalysisDetail> => (
    apiClient.post(`/profile-analyses/${id}/approve`, { document })
  ),
}
