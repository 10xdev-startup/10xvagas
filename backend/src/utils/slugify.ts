const SLUG_PREFIX_LENGTH = 6
const MAX_SLUG_TEXT_LENGTH = 60
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PREFIX_REGEX = /^[0-9a-f]{6}$/

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, MAX_SLUG_TEXT_LENGTH)
    .replace(/-+$/g, '')
}

export function makeSlug(name: string, id: string): string {
  if (!isUUID(id)) throw new Error('Nao e possivel gerar slug para um id que nao seja UUID')
  const base = slugify(name)
  const prefix = id.slice(0, SLUG_PREFIX_LENGTH).toLowerCase()
  return base ? `${base}-${prefix}` : prefix
}

export function isUUID(value: string): boolean {
  return UUID_REGEX.test(value)
}

/**
 * Valida a gramatica inteira antes de devolver o prefixo. O teste da fronteira
 * impede que os seis ultimos caracteres de um UUID cru sejam aceitos como slug.
 */
export function extractSlugPrefix(value: string): string | null {
  const candidate = value.toLowerCase()
  if (PREFIX_REGEX.test(candidate)) return candidate
  if (candidate.length > MAX_SLUG_TEXT_LENGTH + SLUG_PREFIX_LENGTH + 1) return null

  const boundary = candidate.length - SLUG_PREFIX_LENGTH - 1
  if (boundary < 1 || candidate[boundary] !== '-') return null

  const decorative = candidate.slice(0, boundary)
  const prefix = candidate.slice(boundary + 1)
  if (!PREFIX_REGEX.test(prefix)) return null
  if (decorative.length > MAX_SLUG_TEXT_LENGTH || slugify(decorative) !== decorative) return null
  return prefix
}

export function slugPrefixToUUIDRange(prefix: string): { min: string; max: string } {
  const normalized = prefix.toLowerCase()
  if (!PREFIX_REGEX.test(normalized)) throw new Error('Prefixo de UUID invalido')
  return {
    min: `${normalized}00-0000-0000-0000-000000000000`,
    max: `${normalized}ff-ffff-ffff-ffff-ffffffffffff`,
  }
}
