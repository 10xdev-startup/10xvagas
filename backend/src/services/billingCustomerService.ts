import type Stripe from 'stripe'
import { BillingModel } from '@/models/BillingModel'
import { StripeService } from '@/services/stripeService'
import { AppError } from '@/utils/AppError'

export const BillingCustomerService = {
  async getOrCreate(userId: string, email: string): Promise<Stripe.Customer> {
    const storedId = await BillingModel.getCustomerId(userId)
    if (storedId) {
      const stored = await StripeService.retrieveCustomer(storedId)
      if (stored) return stored
    }

    const customer = await StripeService.createCustomer(userId, email)
    await BillingModel.setCustomerId(userId, customer.id)
    return customer
  },

  async requireAvailableCredits(userId: string, email: string): Promise<{
    balanceCents: number
    currency: string
    customer: Stripe.Customer
  }> {
    const customer = await BillingCustomerService.getOrCreate(userId, email)
    const balance = await StripeService.getBalance(customer)
    if (balance.balanceCents <= 0) {
      throw new AppError(402, 'Adicione creditos para analisar seu curriculo', 'INSUFFICIENT_CREDITS')
    }
    return { ...balance, customer }
  },
}
