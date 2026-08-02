import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

function readBrowserConfig(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Credenciais publicas do Supabase nao configuradas')
  }

  return { url, key }
}

export function createClient(): SupabaseClient {
  if (browserClient) return browserClient

  const { url, key } = readBrowserConfig()
  browserClient = createBrowserClient(url, key)
  return browserClient
}

export const supabase = createClient()
