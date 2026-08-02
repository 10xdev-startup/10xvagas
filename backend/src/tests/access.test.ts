import { afterEach, describe, expect, it } from '@jest/globals'
import { isAllowedUserEmail } from '@/utils/access'

const originalAllowedEmails = process.env['ALLOWED_USER_EMAILS']
const originalNodeEnv = process.env['NODE_ENV']

afterEach(() => {
  if (originalAllowedEmails === undefined) delete process.env['ALLOWED_USER_EMAILS']
  else process.env['ALLOWED_USER_EMAILS'] = originalAllowedEmails
  if (originalNodeEnv === undefined) delete process.env['NODE_ENV']
  else process.env['NODE_ENV'] = originalNodeEnv
})

describe('isAllowedUserEmail', () => {
  it('restringe o workspace aos emails configurados', () => {
    process.env['ALLOWED_USER_EMAILS'] = 'augusto@example.com'
    expect(isAllowedUserEmail('AUGUSTO@example.com')).toBe(true)
    expect(isAllowedUserEmail('intruso@example.com')).toBe(false)
  })

  it('falha fechado em producao sem allowlist', () => {
    delete process.env['ALLOWED_USER_EMAILS']
    process.env['NODE_ENV'] = 'production'
    expect(isAllowedUserEmail('qualquer@example.com')).toBe(false)
  })
})
