import { createHash } from 'node:crypto'

/**
 * Identificador publico de vaga: `<decorativo>-<sufixo>`.
 *
 * O decorativo e apresentacao (titulo + empresa) e pode mudar sem quebrar o
 * link. O sufixo carrega a identidade: 10 hex derivados da chave interna.
 * Ver decisoes em `.cursor/plans/fazendo/url-slug-vaga-publica.plan.md`.
 */

const SUFFIX_LENGTH = 10
const MAX_DECORATIVE_LENGTH = 60
const SUFFIX_PATTERN = /^[0-9a-f]+$/

export function normalizeSlugText(value: string): string {
  return value
    .normalize('NFD')
    // Faixa de combining marks escrita com escape — combining mark literal e
    // invisivel no editor e vira bug silencioso.
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function truncateAtBoundary(value: string, max: number): string {
  if (value.length <= max) return value
  const cut = value.slice(0, max)
  const lastSeparator = cut.lastIndexOf('-')
  return (lastSeparator > 0 ? cut.slice(0, lastSeparator) : cut).replace(/-$/, '')
}

/** Sufixo estavel derivado da identidade interna. Nunca deriva do decorativo. */
export function publicIdSuffix(internalId: string): string {
  return createHash('sha256').update(internalId).digest('hex').slice(0, SUFFIX_LENGTH)
}

export function buildPublicId(internalId: string, decorativeParts: string[]): string {
  const suffix = publicIdSuffix(internalId)
  const decorative = truncateAtBoundary(
    normalizeSlugText(decorativeParts.filter(Boolean).join(' ')),
    MAX_DECORATIVE_LENGTH,
  )
  return decorative ? `${decorative}-${suffix}` : suffix
}

/**
 * Valida a gramatica inteira antes de qualquer lookup: conteudo, comprimento e
 * fronteira. Validar so a janela final aceitaria um UUID cru, cujo ultimo grupo
 * tambem e hexadecimal.
 */
export function parsePublicId(value: string): { suffix: string; decorative: string } | null {
  if (typeof value !== 'string') return null

  const candidate = value.trim().toLocaleLowerCase('en-US')
  if (!candidate || candidate.length > MAX_DECORATIVE_LENGTH + 1 + SUFFIX_LENGTH) return null
  if (candidate !== normalizeSlugText(candidate)) return null

  if (candidate.length === SUFFIX_LENGTH) {
    return SUFFIX_PATTERN.test(candidate) ? { suffix: candidate, decorative: '' } : null
  }

  // Fronteira obrigatoria: o char antes do sufixo tem de ser o separador. Sem
  // isso, `...d21eec081645` (fim de UUID) passaria como sufixo valido.
  const separatorIndex = candidate.length - SUFFIX_LENGTH - 1
  if (separatorIndex <= 0 || candidate[separatorIndex] !== '-') return null

  const suffix = candidate.slice(separatorIndex + 1)
  if (!SUFFIX_PATTERN.test(suffix)) return null

  return { suffix, decorative: candidate.slice(0, separatorIndex) }
}
