import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient(): Promise<ReturnType<typeof createServerClient>> {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Credenciais publicas do Supabase nao configuradas')
  }

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Components nao podem gravar cookies. O Proxy atualiza a sessao.
        }
      },
    },
  })
}
