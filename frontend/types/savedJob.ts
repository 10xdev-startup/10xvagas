import type { RadarJob } from '@/types/job'

export type SavedJobSnapshot = Omit<RadarJob, 'id'>

export type SavedJobResponse = {
  id: string
  jobKey: string
  snapshot: SavedJobSnapshot
  savedAt: string
  updatedAt: string
}
