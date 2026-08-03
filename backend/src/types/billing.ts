export const BILLING_FEATURES = [
  'profile_extracted',
  'job_match_judged',
  'cv_adapted',
  'form_answer_generated',
] as const

export const TOKEN_TYPES = ['input', 'output', 'cached'] as const

export type BillingFeature = typeof BILLING_FEATURES[number]
export type TokenType = typeof TOKEN_TYPES[number]

export interface CheckoutMetadata {
  checkoutType: 'credits_pack'
  platform: string
  product: string
  userId: string
}

export interface BillingPack {
  amountCents: number
  currency: string
  lookupKey: string
}

export interface BillingStatus {
  balanceCents: number
  checkoutEnabled: boolean
  currency: string
  hasCustomer: boolean
  packs: BillingPack[]
}

export interface MeterEventInput {
  customerId: string
  eventName: string
  identifier?: string
  value: number
  dimensions?: Record<string, string>
}
