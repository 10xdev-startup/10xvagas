import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { supabase } from '@/database/supabase'
import { AiUsageModel } from '@/models/AiUsageModel'

jest.mock('@/database/supabase', () => ({ supabase: { from: jest.fn() } }))

const fromMock = supabase.from as unknown as jest.Mock

describe('AiUsageModel.releaseAfterFailure', () => {
  beforeEach(() => { fromMock.mockReset() })

  it('mantém falha transitória sob lease antes de permitir novo claim', async () => {
    const stateEq = jest.fn().mockResolvedValue({ error: null } as never)
    const idEq = jest.fn().mockReturnValue({ eq: stateEq })
    const update = jest.fn().mockReturnValue({ eq: idEq })
    fromMock.mockReturnValue({ update })

    await AiUsageModel.releaseAfterFailure('usage-1', 'Stripe indisponível', false)

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      settlement_error: 'Stripe indisponível',
      settlement_status: 'processing',
    }))
    expect(stateEq).toHaveBeenCalledWith('settlement_status', 'processing')
  })

  it('marca erro permanente como failed', async () => {
    const stateEq = jest.fn().mockResolvedValue({ error: null } as never)
    const idEq = jest.fn().mockReturnValue({ eq: stateEq })
    const update = jest.fn().mockReturnValue({ eq: idEq })
    fromMock.mockReturnValue({ update })

    await AiUsageModel.releaseAfterFailure('usage-1', 'RATE_NOT_UNIQUE', true)

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ settlement_status: 'failed' }))
  })
})
