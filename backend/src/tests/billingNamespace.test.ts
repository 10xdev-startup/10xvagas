import { describe, expect, it } from '@jest/globals'
import {
  BILLING_NAMESPACE,
  belongsToBillingNamespace,
  namespacedMeterEventName,
} from '@/utils/billingNamespace'

describe('billingNamespace', () => {
  it('usa o namespace exclusivo do 10xVagas', () => {
    expect(BILLING_NAMESPACE).toBe('10xvagas')
    expect(namespacedMeterEventName('tokens')).toBe('10xvagas_tokens')
  })

  it('aceita apenas metadata com product e platform corretos', () => {
    expect(belongsToBillingNamespace({ product: '10xvagas', platform: '10xvagas' })).toBe(true)
    expect(belongsToBillingNamespace({ product: '10xvagas' })).toBe(false)
    expect(belongsToBillingNamespace({ platform: '10xvagas' })).toBe(false)
    expect(belongsToBillingNamespace({ product: '10xdev', platform: '10xdev' })).toBe(false)
    expect(belongsToBillingNamespace(null)).toBe(false)
  })
})
