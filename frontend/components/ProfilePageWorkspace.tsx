'use client'

import { useEffect, useState } from 'react'
import { ProfileOnboarding } from '@/components/ProfileOnboarding'
import { ProfileWorkbench } from '@/components/ProfileWorkbench'
import { profileService } from '@/services/profileService'
import type { CanonicalProfile } from '@/types/profile'

export function ProfilePageWorkspace() {
  const [profile, setProfile] = useState<CanonicalProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    profileService.get()
      .then((response) => {
        if (active) setProfile(response.profile)
      })
      .catch(() => {
        if (active) setError('Nao foi possivel carregar seu Perfil Canonico.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  function refreshProfile(): void {
    void profileService.get()
      .then((response) => setProfile(response.profile))
      .catch(() => setError('O perfil foi aprovado, mas a tela não conseguiu recarregá-lo.'))
  }

  if (loading) {
    return <div className="surface-panel min-h-64 animate-pulse rounded-3xl" aria-label="Carregando perfil" />
  }
  if (error) {
    return (
      <div className="surface-panel rounded-3xl p-8">
        <p className="text-sm text-destructive">{error}</p>
        <button className="mt-4 text-sm text-primary underline" onClick={() => window.location.reload()} type="button">
          Tentar novamente
        </button>
      </div>
    )
  }
  if (!profile) return <ProfileOnboarding onProfileApproved={refreshProfile} />
  return <ProfileWorkbench onProfileApproved={refreshProfile} profile={profile} />
}
