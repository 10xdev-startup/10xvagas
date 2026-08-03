import { describe, expect, it } from '@jest/globals'
import {
  getFeatureMeterEventName,
  getTokenMeterEventName,
} from '@/services/stripeService'

describe('meter event names', () => {
  it('mantem tokens e features dentro do namespace 10xvagas', () => {
    expect(getTokenMeterEventName()).toBe('10xvagas_tokens')
    expect(getFeatureMeterEventName('profile_extracted')).toBe('10xvagas_profile_extracted')
    expect(getFeatureMeterEventName('job_match_judged')).toBe('10xvagas_job_match_judged')
    expect(getFeatureMeterEventName('cv_adapted')).toBe('10xvagas_cv_adapted')
    expect(getFeatureMeterEventName('form_answer_generated')).toBe('10xvagas_form_answer_generated')
  })
})
