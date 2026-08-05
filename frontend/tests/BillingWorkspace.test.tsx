import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { BillingWorkspace } from '@/components/BillingWorkspace'
import { apiClient } from '../services/apiClient'

declare const jest: typeof import('@jest/globals').jest

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}))

describe('BillingWorkspace', () => {
  it('mostra saldo e pacotes retornados pela API', async () => {
    jest.mocked(apiClient.get).mockResolvedValue({
      balanceCents: 1250,
      checkoutEnabled: true,
      currency: 'BRL',
      hasCustomer: true,
      minimumAnalysisCreditsCents: 5,
      packs: [
        { amountCents: 2500, currency: 'BRL', lookupKey: '10xvagas_credits_brl_25' },
      ],
    })

    render(<BillingWorkspace />)

    expect(await screen.findByText(/12,50/)).toBeInTheDocument()
    expect(screen.getByText(/25,00/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /adicionar créditos/i })).toBeEnabled()
  })
})
