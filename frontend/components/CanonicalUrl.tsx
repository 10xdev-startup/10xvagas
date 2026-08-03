'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Rede de compatibilidade, nao caminho principal: links internos ja nascem
 * canonicos pelo helper `jobPath`. Isto cobre link antigo ou com decorativo
 * divergente, preservando query string e hash.
 */
export function CanonicalUrl({ canonicalPath }: { canonicalPath: string }): null {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    if (pathname === canonicalPath) return
    const query = searchParams.toString()
    const hash = typeof window === 'undefined' ? '' : window.location.hash
    router.replace(`${canonicalPath}${query ? `?${query}` : ''}${hash}`)
  }, [canonicalPath, pathname, router, searchParams])

  return null
}
