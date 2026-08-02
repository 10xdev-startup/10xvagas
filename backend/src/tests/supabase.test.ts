import { beforeEach, describe, expect, it, jest } from '@jest/globals'

const mockCreateClient = jest.fn(() => ({ from: jest.fn() }))

jest.mock('@supabase/supabase-js', () => ({ createClient: mockCreateClient }))
jest.mock('ws', () => ({ __esModule: true, default: class WebSocketTransport {} }))

describe('cliente Supabase do backend', () => {
  beforeEach(() => {
    jest.resetModules()
    mockCreateClient.mockClear()
    process.env['SUPABASE_URL'] = 'https://example.supabase.co'
    process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'service-role-for-test'
  })

  it('configura transporte websocket compativel com Node 20', async () => {
    const { supabase } = await import('@/database/supabase')

    void supabase.from

    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-for-test',
      expect.objectContaining({
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { transport: expect.any(Function) },
      }),
    )
  })
})
