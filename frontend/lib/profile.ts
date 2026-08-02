import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

export type CanonicalProfile = {
  identity: { full_name: string; headline: { pt: string; en: string }; location: { city: string; state: string; country: string } }
  work_preferences: { target_roles: string[]; desired_work_models: string[]; hybrid_locations: Array<{ city: string; state: string; include_metropolitan_region: boolean }>; target_markets: string[]; accepted_employment_types: string[] | null; target_seniority: number | null; salary_expectations: unknown[] }
  skills_desired: Array<{ name: string; priority: number }>
  skills_known: { desired_and_evidenced: string[]; known_but_not_desired_for_matching: string[]; secondary_or_limited_evidence: string[] }
  experience: Array<{ company: string; role: { pt: string; en: string }; start_date: string; end_date: string | null; current: boolean; location: string; highlights: { pt: string[]; en: string[] } }>
  facts_pending_confirmation: Array<{ question_pt: string; question_en?: string }>
}

export async function getCanonicalProfile(): Promise<CanonicalProfile> {
  const file = path.resolve(process.cwd(), '../engine/experiment/data/canonical-profile.json')
  const raw = JSON.parse(await readFile(file, 'utf-8')) as CanonicalProfile

  // Projeta somente o que a UI usa. O JSON de origem tambem contem contato e
  // narrativas privadas, que nunca devem atravessar a fronteira Server/Client.
  return {
    identity: {
      full_name: raw.identity.full_name,
      headline: { pt: raw.identity.headline.pt, en: raw.identity.headline.en },
      location: {
        city: raw.identity.location.city,
        state: raw.identity.location.state,
        country: raw.identity.location.country,
      },
    },
    work_preferences: raw.work_preferences,
    skills_desired: raw.skills_desired,
    skills_known: raw.skills_known,
    experience: raw.experience,
    facts_pending_confirmation: raw.facts_pending_confirmation,
  }
}
