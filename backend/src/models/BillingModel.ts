import { supabase } from '@/database/supabase'

const TABLE = 'users'
const CUSTOMER_COLUMN = 'stripe_customer_id'

interface CustomerRow {
  stripe_customer_id: string | null
}

/** Acesso aos dados locais de billing. Toda query e limitada ao usuario recebido da autenticacao. */
export const BillingModel = {
  async getCustomerId(userId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select(CUSTOMER_COLUMN)
      .eq('id', userId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as CustomerRow | null)?.stripe_customer_id ?? null
  },

  async setCustomerId(userId: string, customerId: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
      .eq('id', userId)
    if (error) throw new Error(error.message)
  },
}
