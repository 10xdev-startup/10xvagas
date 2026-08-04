export type AiUsageSettlementStatus = 'started' | 'captured' | 'pending' | 'processing' | 'settled' | 'failed'
export type AiUsageFeatureMeterStatus = 'pending' | 'emitted' | 'not_applicable'

export interface AiUsageEventRow {
  id: string
  user_id: string
  job_id: string
  analysis_id: string | null
  stripe_customer_id: string
  operation: string
  provider: string
  requested_model: string
  model: string
  api_model: string | null
  input_tokens: number
  output_tokens: number
  cached_tokens: number
  total_tokens: number
  cost_cents: number | null
  settlement_status: AiUsageSettlementStatus
  settlement_attempts: number
  settlement_error: string | null
  stripe_balance_transaction_id: string | null
  meter_identifiers: Record<string, string>
  meter_status: 'pending' | 'emitted' | 'failed'
  meter_error: string | null
  feature_meter_status: AiUsageFeatureMeterStatus
  created_at: string
  updated_at: string
}
