'use client'

import type { User as SupabaseUser } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getSafeAuthRedirect } from '@/lib/authRedirect'
import { supabase } from '@/lib/supabase/client'

interface AuthContextValue {
  user: SupabaseUser | null
  isLoading: boolean
  isAuthenticated: boolean
  signInWithGoogle: (redirectTarget?: string | null) => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    void supabase.auth.getUser()
      .then(({ data }) => {
        if (active) setUser(data.user ?? null)
      })
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = useCallback(async (redirectTarget?: string | null): Promise<void> => {
    const destination = getSafeAuthRedirect(redirectTarget)
    const callbackUrl = new URL('/auth/callback', window.location.origin)

    document.cookie = `post_login_redirect=${encodeURIComponent(destination)}; Path=/; Max-Age=300; SameSite=Lax`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
        queryParams: { prompt: 'select_account' },
      },
    })

    if (error) {
      document.cookie = 'post_login_redirect=; Path=/; Max-Age=0; SameSite=Lax'
      throw error
    }
  }, [])

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<void> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async (): Promise<void> => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    isAuthenticated: user !== null,
    signInWithGoogle,
    signInWithEmail,
    signOut,
  }), [isLoading, signInWithEmail, signInWithGoogle, signOut, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
