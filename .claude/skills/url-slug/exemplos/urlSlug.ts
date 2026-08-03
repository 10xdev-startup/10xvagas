function **normalizedLengths**(policy: UrlSlugPolicy) — L16 (+9 linhas)


export function **slugify**(text: string, maxLength = 60) — L27 (+8 linhas)

export function **isUuid**(value: string) — L37 (+2 linhas)

export function **compactUuid**(value: string) — L41 (+3 linhas)

export function **makeSlug**(name: string, id: string, policy: UrlSlugPolicy) — L46 (+5 linhas)


function **readPrefix**(slug: string, length: number) — L53 (+13 linhas)


export function **parseSlugPrefix**(slug: string, policy: UrlSlugPolicy) — L68 (+6 linhas)

export function **prefixToUuidRange**(prefix: string) — L76
export type UrlSlugPolicy = {
  generatedPrefixLength: number
  acceptedPrefixLengths: readonly number[]
  maxNameLength?: number
}

export type ParsedSlugPrefix = {
  value: string
  length: number
  name: string
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HEX_REGEX = /^[0-9a-f]+$/i

function normalizedLengths(policy: UrlSlugPolicy): number[] {
  const lengths = [...new Set(policy.acceptedPrefixLengths)]
  if (lengths.length === 0 || lengths.some((length) => !Number.isInteger(length) || length < 1 || length > 32)) {
    throw new Error('acceptedPrefixLengths deve conter inteiros entre 1 e 32')
  }
  if (!lengths.includes(policy.generatedPrefixLength)) {
    throw new Error('generatedPrefixLength precisa estar entre os comprimentos aceitos')
  }
  return lengths.sort((a, b) => b - a)
}

export function slugify(text: string, maxLength = 60): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
}

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value)
}

export function compactUuid(value: string): string {
  if (!isUuid(value)) throw new Error('UUID inválido')
  return value.replace(/-/g, '').toLowerCase()
}

export function makeSlug(name: string, id: string, policy: UrlSlugPolicy): string {
  normalizedLengths(policy)
  const base = slugify(name, policy.maxNameLength ?? 60)
  const prefix = compactUuid(id).slice(0, policy.generatedPrefixLength)
  return base ? `${base}-${prefix}` : prefix
}

function readPrefix(slug: string, length: number): ParsedSlugPrefix | null {
  const start = slug.length - length
  if (start < 0) return null
  if (start > 0 && slug[start - 1] !== '-') return null

  const value = slug.slice(start)
  if (!HEX_REGEX.test(value)) return null

  return {
    value: value.toLowerCase(),
    length,
    name: start > 0 ? slug.slice(0, start - 1) : '',
  }
}

export function parseSlugPrefix(slug: string, policy: UrlSlugPolicy): ParsedSlugPrefix | null {
  for (const length of normalizedLengths(policy)) {
    const parsed = readPrefix(slug, length)
    if (parsed) return parsed
  }
  return null
}

export function prefixToUuidRange(prefix: string): { min: string; max: string } {
  if (!HEX_REGEX.test(prefix) || prefix.length > 32) throw new Error('Prefixo hexadecimal inválido')
  const normalized = prefix.toLowerCase()
  const format = (padding: string): string => {
    const compact = normalized + padding.repeat(32 - normalized.length)
    return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`
  }
  return { min: format('0'), max: format('f') }
}
