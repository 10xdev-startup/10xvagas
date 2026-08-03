import { apiClient } from '@/services/apiClient'
import type { JobListResponse, RadarJob } from '@/types/job'

export const jobService = {
  list: () => apiClient.get<JobListResponse>('/jobs'),
  getById: (idOrPublicId: string) => apiClient.get<RadarJob>(`/jobs/${encodeURIComponent(idOrPublicId)}`),
}

