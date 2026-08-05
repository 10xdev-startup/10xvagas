import { supabase } from '@/database/supabase'
import type { CheckoutCreditGrantClaim } from '@/types/checkoutCreditGrant'

const TABLE = 'checkout_credit_grant'

export interface ClaimCheckoutCreditGrantInput {
  amountCents: number
  checkoutSessionId: string
  currency: string
  customerId: string
  paymentIntentId: string
  stripeEventId: string
  userId: string
}

/** Ledger duravel do checkout. Escrita exclusiva do backend service-role. */
export const CheckoutCreditGrantModel = {
  async claim(input: ClaimCheckoutCreditGrantInput): Promise<CheckoutCreditGrantClaim> {
    const { data, error } = await supabase.rpc('claim_checkout_credit_grant', {
      p_amount_cents: input.amountCents,
      p_checkout_session_id: input.checkoutSessionId,
      p_currency: input.currency,
      p_customer_id: input.customerId,
      p_lease_seconds: 300,
      p_payment_intent_id: input.paymentIntentId,
      p_stripe_event_id: input.stripeEventId,
      p_user_id: input.userId,
    })
    if (error) throw new Error(error.message)
    const row = Array.isArray(data) ? data[0] : data
    if (!row) throw new Error('Checkout nao pode ser reclamado para concessao de creditos')
    return row as CheckoutCreditGrantClaim
  },

  async markGranted(paymentIntentId: string, balanceTransactionId: string): Promise<void> {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from(TABLE)
      .update({
        error_message: null,
        granted_at: now,
        lease_expires_at: null,
        status: 'granted',
        stripe_balance_transaction_id: balanceTransactionId,
        updated_at: now,
      })
      .eq('payment_intent_id', paymentIntentId)
      .eq('status', 'processing')
    if (error) throw new Error(error.message)
  },

  async releaseAfterFailure(paymentIntentId: string, message: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .update({
        error_message: message.slice(0, 500),
        lease_expires_at: null,
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('payment_intent_id', paymentIntentId)
      .eq('status', 'processing')
    if (error) throw new Error(error.message)
  },
}
