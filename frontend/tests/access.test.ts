import { afterEach, describe, expect, it } from '@jest/globals'
import { isAllowedUserEmail } from '@/lib/access'

const originalAllowedEmails = process.env.ALLOWED_USER_EMAILS
const originalNodeEnv = process.env.NODE_ENV

afterEach(() => {
  process.env.ALLOWED_USER_EMAILS = originalAllowedEmails
  Object.defineProperty(process.env, 'NODE_ENV', { value: originalNodeEnv, configurable: true, writable: true })
})

describe('isAllowedUserEmail', () => {
  it('aceita apenas emails configurados ignorando caixa e espacos', () => {
    process.env.ALLOWED_USER_EMAILS = ' Augusto@Example.com, outro@example.com '
    expect(isAllowedUserEmail('augusto@example.com')).toBe(true)
    expect(isAllowedUserEmail('intruso@example.com')).toBe(false)
  })

  it('falha fechado em producao sem allowlist', () => {
    delete process.env.ALLOWED_USER_EMAILS
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true, writable: true })
    expect(isAllowedUserEmail('qualquer@example.com')).toBe(false)
  })
})
