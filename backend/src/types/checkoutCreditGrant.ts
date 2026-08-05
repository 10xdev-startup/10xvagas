export type CheckoutCreditGrantStatus = 'processing' | 'granted' | 'failed'

export interface CheckoutCreditGrantRow {
  id: string
  user_id: string
  stripe_event_id: string
  checkout_session_id: string
  payment_intent_id: string
  customer_id: string
  amount_cents: number
  currency: string
  status: CheckoutCreditGrantStatus
  attempt_count: number
  lease_expires_at: string | null
  stripe_balance_transaction_id: string | null
  error_message: string | null
  granted_at: string | null
  created_at: string
  updated_at: string
}

export interface CheckoutCreditGrantClaim extends CheckoutCreditGrantRow {
  should_process: boolean
}
