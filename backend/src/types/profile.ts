export interface CanonicalProfile {
  experience: Array<{
    company: string
    current: boolean
    end_date: string | null
    highlights: { en: string[]; pt: string[] }
    location: string
    role: { en: string; pt: string }
    start_date: string
  }>
  facts_pending_confirmation: Array<{ question_en?: string; question_pt: string }>
  identity: {
    full_name: string
    headline: { en: string; pt: string }
    location: { city: string; country: string; state: string }
  }
  skills_desired: Array<{ name: string; priority: number }>
  skills_known: {
    desired_and_evidenced: string[]
    known_but_not_desired_for_matching: string[]
    secondary_or_limited_evidence: string[]
  }
  work_preferences: {
    accepted_employment_types: string[] | null
    desired_work_models: string[]
    hybrid_locations: Array<{ city: string; include_metropolitan_region: boolean; state: string }>
    salary_expectations: unknown[]
    target_markets: string[]
    target_roles: string[]
    target_seniority: number | null
  }
}

export interface ProfileRow {
  document: Record<string, unknown>
  user_id: string
}

/** Projecao deliberada: contato, narrativas privadas e campos futuros nao atravessam a API. */
export function toPublicProfile(row: ProfileRow): CanonicalProfile {
  const raw = row.document as unknown as CanonicalProfile
  return {
    experience: raw.experience,
    facts_pending_confirmation: raw.facts_pending_confirmation,
    identity: {
      full_name: raw.identity.full_name,
      headline: { en: raw.identity.headline.en, pt: raw.identity.headline.pt },
      location: {
        city: raw.identity.location.city,
        country: raw.identity.location.country,
        state: raw.identity.location.state,
      },
    },
    skills_desired: raw.skills_desired,
    skills_known: raw.skills_known,
    work_preferences: raw.work_preferences,
  }
}
