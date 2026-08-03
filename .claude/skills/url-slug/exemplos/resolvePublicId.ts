export async function **resolvePublicId**(...) — L14 (+17 linhas)
import { isUuid, parseSlugPrefix, prefixToUuidRange, type UrlSlugPolicy } from './urlSlug'

export type PublicIdCandidate = { id: string }
export type CandidateLookup = (
  range: { min: string; max: string },
  options: { limit: number }
) => Promise<PublicIdCandidate[]>

export type ResolvePublicIdDependencies = {
  lookupCandidates: CandidateLookup
  onAmbiguous?: (input: string, candidateIds: string[]) => void
}

export async function resolvePublicId(
  input: string,
  policy: UrlSlugPolicy,
  dependencies: ResolvePublicIdDependencies
): Promise<string | null> {
  if (isUuid(input)) return input.toLowerCase()

  const parsed = parseSlugPrefix(input, policy)
  if (!parsed) return null

  const candidates = await dependencies.lookupCandidates(prefixToUuidRange(parsed.value), { limit: 2 })
  if (candidates.length === 1) return candidates[0]?.id ?? null

  if (candidates.length > 1) {
    dependencies.onAmbiguous?.(input, candidates.map((candidate) => candidate.id))
  }
  return null
}
