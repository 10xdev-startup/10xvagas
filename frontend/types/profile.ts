export type CanonicalProfile = {
  identity: { full_name: string; headline: { pt: string; en: string }; location: { city: string; state: string; country: string } }
  work_preferences: { target_roles: string[]; desired_work_models: string[]; hybrid_locations: Array<{ city: string; state: string; include_metropolitan_region: boolean }>; target_markets: string[]; accepted_employment_types: string[] | null; target_seniority: number | null; salary_expectations: unknown[] }
  skills_desired: Array<{ name: string; priority: number }>
  skills_known: { desired_and_evidenced: string[]; known_but_not_desired_for_matching: string[]; secondary_or_limited_evidence: string[] }
  experience: Array<{ company: string; role: { pt: string; en: string }; start_date: string; end_date: string | null; current: boolean; location: string; highlights: { pt: string[]; en: string[] } }>
  facts_pending_confirmation: Array<{ question_pt: string; question_en?: string }>
}
