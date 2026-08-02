'use client'

import { useCallback, useSyncExternalStore } from 'react'

export type SearchPreferences = {
  brazilRemote: boolean
  bhHybrid: boolean
  internationalRemote: boolean
  minScore: number
}

const STORAGE_KEY = '10xvagas:search-preferences'
const LEGACY_STORAGE_KEY = '10xjobs:search-preferences'
const EVENT_NAME = '10xvagas-search-preferences-change'
const DEFAULTS: SearchPreferences = { brazilRemote: true, bhHybrid: true, internationalRemote: true, minScore: 0 }
let cachedRaw: string | null | undefined
let cachedValue = DEFAULTS

function read(): SearchPreferences {
  if (typeof window === 'undefined') return DEFAULTS
  let raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) {
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacyRaw !== null) {
      localStorage.setItem(STORAGE_KEY, legacyRaw)
      raw = legacyRaw
    }
  }
  if (raw === cachedRaw) return cachedValue
  try { cachedValue = { ...DEFAULTS, ...(raw ? JSON.parse(raw) as Partial<SearchPreferences> : {}) } } catch { cachedValue = DEFAULTS }
  cachedRaw = raw
  return cachedValue
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('storage', callback)
  window.addEventListener(EVENT_NAME, callback)
  return () => { window.removeEventListener('storage', callback); window.removeEventListener(EVENT_NAME, callback) }
}

export function useSearchPreferences() {
  const preferences = useSyncExternalStore(subscribe, read, () => DEFAULTS)
  const update = useCallback((patch: Partial<SearchPreferences>) => {
    const next = { ...read(), ...patch }
    const raw = JSON.stringify(next)
    localStorage.setItem(STORAGE_KEY, raw)
    cachedRaw = raw
    cachedValue = next
    window.dispatchEvent(new Event(EVENT_NAME))
  }, [])
  const reset = useCallback(() => update(DEFAULTS), [update])
  return { preferences, update, reset }
}
