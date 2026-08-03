import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { MarketingLandingPage } from '@/components/MarketingLandingPage'

describe('MarketingLandingPage', () => {
  it('apresenta a proposta e leva o CTA principal ao dashboard autenticado', () => {
    render(<MarketingLandingPage />)

    expect(screen.getByRole('heading', { level: 1, name: /sua busca por trabalho precisa de direção/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /começar meu radar/i })).toHaveAttribute('href', '/login?redirect=/dashboard')
    expect(screen.getByText(/bh e região/i)).toBeInTheDocument()
    expect(screen.getByText(/começa aqui/i)).toBeInTheDocument()
  })

  it('preserva o destino protegido no CTA de login', () => {
    render(<MarketingLandingPage loginUrl="/login?redirect=%2Fsaved" />)

    expect(screen.getByRole('link', { name: /começar meu radar/i })).toHaveAttribute('href', '/login?redirect=%2Fsaved')
  })
})
