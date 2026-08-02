'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getJobKey, savedJobService } from '@/services/savedJobService'
import type { RadarJob } from '@/types/job'

export type SavedJob = RadarJob & { savedAt: string }

const STORAGE_PREFIX = '10xvagas:saved-jobs:'
const LEGACY_STORAGE_PREFIX = '10xjobs:saved-jobs:'
const EVENT_NAME = '10xvagas-saved-jobs-change'
const EMPTY_SAVED_JOBS: SavedJob[] = []
const snapshotCache = new Map<string, { raw: string | null; value: SavedJob[] }>()

function storageKey(userId: string | undefined): string {
  return `${STORAGE_PREFIX}${userId ?? 'local'}`
}

function readSnapshot(key: string): SavedJob[] {
  if (typeof window === 'undefined') return EMPTY_SAVED_JOBS
  let raw = window.localStorage.getItem(key)
  if (raw === null && key.startsWith(STORAGE_PREFIX)) {
    const legacyKey = key.replace(STORAGE_PREFIX, LEGACY_STORAGE_PREFIX)
    const legacyRaw = window.localStorage.getItem(legacyKey)
    if (legacyRaw !== null) {
      window.localStorage.setItem(key, legacyRaw)
      raw = legacyRaw
    }
  }
  const cached = snapshotCache.get(key)
  if (cached?.raw === raw) return cached.value

  let value: SavedJob[] = []
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) value = parsed as SavedJob[]
    } catch {
      value = []
    }
  }
  snapshotCache.set(key, { raw, value })
  return value
}

function writeSnapshot(key: string, value: SavedJob[]): void {
  const raw = JSON.stringify(value)
  window.localStorage.setItem(key, raw)
  snapshotCache.set(key, { raw, value })
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: key }))
}

function subscribe(key: string, callback: () => void): () => void {
  function onChange(event: Event): void {
    if (event instanceof StorageEvent && event.key !== key) return
    if (event instanceof CustomEvent && event.detail !== key) return
    callback()
  }
  window.addEventListener('storage', onChange)
  window.addEventListener(EVENT_NAME, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(EVENT_NAME, onChange)
  }
}

export function useSavedJobs(): {
  jobs: SavedJob[]
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error'
  isSaved: (job: RadarJob) => boolean
  save: (job: RadarJob) => void
  remove: (jobId: string) => void
  toggle: (job: RadarJob) => boolean
} {
  const { user, isLoading } = useAuth()
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle')
  const key = storageKey(user?.id)
  const subscribeToKey = useCallback((callback: () => void) => subscribe(key, callback), [key])
  const getSnapshot = useCallback(() => readSnapshot(key), [key])
  const jobs = useSyncExternalStore(subscribeToKey, getSnapshot, () => EMPTY_SAVED_JOBS)

  useEffect(() => {
    if (isLoading || !user) return
    let active = true
    queueMicrotask(() => { if (active) setSyncStatus('syncing') })

    void savedJobService.list()
      .then(async (remote) => {
        if (!active) return
        const local = readSnapshot(key)
        const remoteJobs: SavedJob[] = remote.map((item) => ({
          id: item.jobKey,
          ...item.snapshot,
          savedAt: item.savedAt,
        }))
        const merged = new Map(remoteJobs.map((job) => [getJobKey(job), job]))
        local.forEach((job) => merged.set(getJobKey(job), job))
        writeSnapshot(key, [...merged.values()].toSorted((first, second) => second.savedAt.localeCompare(first.savedAt)))

        const remoteKeys = new Set(remote.map((item) => item.jobKey))
        const pending = local.filter((job) => !remoteKeys.has(getJobKey(job)))
        const results = await Promise.allSettled(pending.map((job) => savedJobService.save(job)))
        if (active) setSyncStatus(results.some((result) => result.status === 'rejected') ? 'error' : 'synced')
      })
      .catch(() => { if (active) setSyncStatus('error') })

    return () => { active = false }
  }, [isLoading, key, user])

  const isSaved = useCallback((job: RadarJob) => {
    const jobKey = getJobKey(job)
    return jobs.some((saved) => saved.id === job.id || getJobKey(saved) === jobKey)
  }, [jobs])
  const save = useCallback((job: RadarJob) => {
    const jobKey = getJobKey(job)
    if (readSnapshot(key).some((saved) => saved.id === job.id || getJobKey(saved) === jobKey)) return
    writeSnapshot(key, [{ ...job, savedAt: new Date().toISOString() }, ...readSnapshot(key)])
    if (user) void savedJobService.save(job).then(() => setSyncStatus('synced')).catch(() => setSyncStatus('error'))
  }, [key, user])
  const remove = useCallback((jobId: string) => {
    const target = readSnapshot(key).find((job) => job.id === jobId || getJobKey(job) === jobId)
    if (!target) return
    writeSnapshot(key, readSnapshot(key).filter((job) => job.id !== target.id))
    if (user) void savedJobService.remove(target).then(() => setSyncStatus('synced')).catch(() => setSyncStatus('error'))
  }, [key, user])
  const toggle = useCallback((job: RadarJob): boolean => {
    const jobKey = getJobKey(job)
    const saved = readSnapshot(key).some((item) => item.id === job.id || getJobKey(item) === jobKey)
    if (saved) remove(jobKey)
    else save(job)
    return !saved
  }, [key, remove, save])

  return { jobs, syncStatus, isSaved, save, remove, toggle }
}
