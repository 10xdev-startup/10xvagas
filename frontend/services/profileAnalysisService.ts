import { apiClient } from '@/services/apiClient'
import type { ProfileAnalysisDetail } from '@/types/profileAnalysis'
import type { ProfileAnalysisJob } from '@/types/profileAnalysis'
import type { ProfileAnalysisModelOption } from '@/types/profileAnalysis'
import type { ProfileAnalysisPreferences } from '@/types/profileAnalysis'

export const profileAnalysisService = {
  create(document: File, preferences: ProfileAnalysisPreferences, modelId: string): Promise<{ job: ProfileAnalysisJob }> {
    const formData = new FormData()
    formData.append('document', document)
    formData.append('modelId', modelId)
    formData.append('preferences', JSON.stringify(preferences))
    return apiClient.upload('/profile-analyses', formData)
  },
  models: (): Promise<{ defaultModelId: string; models: ProfileAnalysisModelOption[] }> => apiClient.get('/profile-analyses/models'),
  list: (): Promise<{ jobs: ProfileAnalysisJob[] }> => apiClient.get('/profile-analyses'),
  get: (id: string): Promise<ProfileAnalysisDetail> => apiClient.get(`/profile-analyses/${id}`),
  cancel: (id: string): Promise<{ job: ProfileAnalysisJob }> => apiClient.post(`/profile-analyses/${id}/cancel`),
  retry: (id: string): Promise<{ job: ProfileAnalysisJob }> => apiClient.post(`/profile-analyses/${id}/retry`),
  approve: (id: string, document: Record<string, unknown>): Promise<ProfileAnalysisDetail> => (
    apiClient.post(`/profile-analyses/${id}/approve`, { document })
  ),
}
