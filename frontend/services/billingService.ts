import { apiClient } from '@/services/apiClient'

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

export const billingService = {
  status: (): Promise<BillingStatus> => apiClient.get('/billing/status'),
  checkout: (lookupKey: string): Promise<{ url: string }> => (
    apiClient.post('/billing/checkout', { lookupKey })
  ),
}
