import { apiClient } from '@/services/apiClient'
import type { RadarJob } from '@/types/job'
import type { SavedJobResponse, SavedJobSnapshot } from '@/types/savedJob'

export function getJobKey(job: Pick<RadarJob, 'source' | 'sourceUrl'>): string {
  return `${job.source.toLocaleLowerCase('en-US')}:${job.sourceUrl.trim().replace(/\/$/, '').toLocaleLowerCase('en-US')}`
}

function toSnapshot(job: RadarJob): SavedJobSnapshot {
  const { id, ...snapshot } = job
  void id
  return snapshot
}

export const savedJobService = {
  list: () => apiClient.get<SavedJobResponse[]>('/saved-jobs'),
  save: (job: RadarJob) => apiClient.post<SavedJobResponse>('/saved-jobs', {
    jobKey: getJobKey(job),
    snapshot: toSnapshot(job),
  }),
  remove: (job: Pick<RadarJob, 'source' | 'sourceUrl'>) =>
    apiClient.delete<{ jobKey: string; removed: boolean }>(`/saved-jobs/${encodeURIComponent(getJobKey(job))}`),
}
