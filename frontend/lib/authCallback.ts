import { getSafeAuthRedirect } from '@/lib/authRedirect'

const HTTP_PROTOCOLS = new Set(['http:', 'https:'])

export function getAuthCallbackOrigin(requestUrl: string, configuredAppUrl?: string): string {
  if (configuredAppUrl) {
    try {
      const configuredUrl = new URL(configuredAppUrl)
      if (HTTP_PROTOCOLS.has(configuredUrl.protocol)) return configuredUrl.origin
    } catch {
      // Ignora configuracao invalida e usa a origem observada na requisicao.
    }
  }

  return new URL(requestUrl).origin
}

export function getAuthCallbackDestination(
  queryRedirect: string | null,
  cookieRedirect: string | null,
): string {
  if (queryRedirect) return getSafeAuthRedirect(queryRedirect)
  if (!cookieRedirect) return getSafeAuthRedirect(null)

  try {
    return getSafeAuthRedirect(decodeURIComponent(cookieRedirect))
  } catch {
    return getSafeAuthRedirect(cookieRedirect)
  }
}
