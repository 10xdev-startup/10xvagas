import { supabase } from '@/database/supabase'
import type { AiUsageEventRow, AiUsageFeatureMeterStatus } from '@/types/aiUsage'

const TABLE = 'ai_usage_event'
const COLUMNS = 'id, user_id, job_id, analysis_id, stripe_customer_id, operation, provider, requested_model, model, api_model, input_tokens, output_tokens, cached_tokens, total_tokens, cost_cents, settlement_status, settlement_attempts, settlement_error, stripe_balance_transaction_id, meter_identifiers, meter_status, meter_error, feature_meter_status, created_at, updated_at'

export const AiUsageModel = {
  async claimPending(workerId: string): Promise<AiUsageEventRow | null> {
    const { data, error } = await supabase.rpc('claim_ai_usage_event', { p_worker_id: workerId })
    if (error) throw new Error(error.message)
    const row = Array.isArray(data) ? data[0] : data
    return (row as AiUsageEventRow | null) ?? null
  },

  async markSettled(
    id: string,
    costCents: number,
    transactionId: string,
    featureMeterStatus: AiUsageFeatureMeterStatus,
  ): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .update({
        cost_cents: costCents,
        settlement_error: null,
        settlement_status: 'settled',
        stripe_balance_transaction_id: transactionId,
        feature_meter_status: featureMeterStatus,
        meter_error: null,
        meter_status: 'emitted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('settlement_status', 'processing')
    if (error) throw new Error(error.message)
  },

  async releaseAfterFailure(id: string, message: string, permanent: boolean): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .update({
        settlement_error: message.slice(0, 500),
        settlement_status: permanent ? 'failed' : 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('settlement_status', 'processing')
    if (error) throw new Error(error.message)
  },

  async findById(id: string): Promise<AiUsageEventRow | null> {
    const { data, error } = await supabase.from(TABLE).select(COLUMNS).eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    return (data as AiUsageEventRow | null) ?? null
  },
}
