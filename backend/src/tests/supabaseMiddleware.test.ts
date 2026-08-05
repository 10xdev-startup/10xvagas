import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { NextFunction, Request, Response } from 'express'
import { supabase } from '@/database/supabase'
import { supabaseMiddleware } from '@/middleware/supabaseMiddleware'
import { UserModel } from '@/models/UserModel'
import { BillingCustomerService } from '@/services/billingCustomerService'
import type { UserRow } from '@/types/user'

jest.mock('@/database/supabase', () => ({
  supabase: { auth: { getUser: jest.fn() } },
}))

jest.mock('@/models/UserModel', () => ({
  UserModel: { findById: jest.fn(), upsertFromAuth: jest.fn() },
}))

jest.mock('@/services/billingCustomerService', () => ({
  BillingCustomerService: { getOrCreate: jest.fn() },
}))

function userRow(customerId: string | null): UserRow {
  return {
    avatar_url: null,
    created_at: '2026-08-04T12:00:00.000Z',
    email: 'user@example.com',
    id: 'user-1',
    name: 'User',
    onboarded_at: null,
    role: 'user',
    status: 'active',
    stripe_customer_id: customerId,
    updated_at: '2026-08-04T12:00:00.000Z',
  }
}

function request(): Request {
  return { headers: { authorization: 'Bearer valid-token' } } as Request
}

function response(): Response {
  const json = jest.fn()
  return { status: jest.fn(() => ({ json })) } as unknown as Response
}

describe('supabaseMiddleware — provisionamento de billing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: {
          email: 'user@example.com',
          id: 'user-1',
          user_metadata: { full_name: 'User' },
        },
      },
      error: null,
    } as never)
  })

  it('nao consulta a Stripe quando o usuario ja possui Customer', async () => {
    jest.mocked(UserModel.findById).mockResolvedValue(userRow('cus_10xvagas'))
    const next = jest.fn() as NextFunction

    await supabaseMiddleware(request(), response(), next)

    expect(BillingCustomerService.getOrCreate).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('cria e vincula Customer no primeiro acesso autenticado', async () => {
    jest.mocked(UserModel.findById).mockResolvedValue(null)
    jest.mocked(UserModel.upsertFromAuth).mockResolvedValue(userRow(null))
    jest.mocked(BillingCustomerService.getOrCreate).mockResolvedValue({ id: 'cus_10xvagas' } as never)
    const next = jest.fn() as NextFunction

    await supabaseMiddleware(request(), response(), next)

    expect(BillingCustomerService.getOrCreate).toHaveBeenCalledWith('user-1', 'user@example.com')
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('nao bloqueia o login quando a Stripe esta indisponivel', async () => {
    jest.mocked(UserModel.findById).mockResolvedValue(userRow(null))
    jest.mocked(BillingCustomerService.getOrCreate).mockRejectedValue(new Error('Stripe offline'))
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const next = jest.fn() as NextFunction

    await supabaseMiddleware(request(), response(), next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(
      '[supabaseMiddleware] falha ao provisionar Customer Stripe',
      { message: 'Stripe offline', userId: 'user-1' },
    )
    errorSpy.mockRestore()
  })
})
