function **trimSlashes**(value: string) — L3 (+2 linhas)


export function **resourcePath**(...) — L7 (+11 linhas)

export function **resourceShareUrl**(...) — L20 (+6 linhas)
export type PublicResourceRef = { id: string; slug?: string }

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '')
}

export function resourcePath(
  collectionPath: string,
  resource: PublicResourceRef,
  subpath?: string,
  query?: URLSearchParams | string
): string {
  const collection = trimSlashes(collectionPath)
  const identity = encodeURIComponent(resource.slug ?? resource.id)
  const suffix = subpath ? `/${trimSlashes(subpath)}` : ''
  const serializedQuery = typeof query === 'string' ? query.replace(/^\?/, '') : query?.toString()
  return `/${collection}/${identity}${suffix}${serializedQuery ? `?${serializedQuery}` : ''}`
}

export function resourceShareUrl(
  origin: string,
  collectionPath: string,
  resource: PublicResourceRef
): string {
  return `${origin.replace(/\/$/, '')}${resourcePath(collectionPath, resource)}`
}
