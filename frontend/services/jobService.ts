import { apiClient } from '@/services/apiClient'
import type { JobListResponse, RadarJob } from '@/types/job'

export const jobService = {
  list: (options: { limit?: number; offset?: number } = {}) => {
    const parameters = new URLSearchParams({
      limit: String(options.limit ?? 100),
      offset: String(options.offset ?? 0),
    })
    return apiClient.get<JobListResponse>(`/jobs?${parameters.toString()}`)
  },
  getById: (idOrPublicId: string) => apiClient.get<RadarJob>(`/jobs/${encodeURIComponent(idOrPublicId)}`),
}
