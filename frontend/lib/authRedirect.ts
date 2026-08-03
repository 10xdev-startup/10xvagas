export function getSafeAuthRedirect(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback

  try {
    const url = new URL(value, 'http://10xvagas.local')
    if (url.origin !== 'http://10xvagas.local' || url.pathname.startsWith('/auth/')) return fallback

    url.searchParams.delete('code')
    url.searchParams.delete('state')
    const search = url.searchParams.toString()
    return `${url.pathname}${search ? `?${search}` : ''}${url.hash}`
  } catch {
    return fallback
  }
}
