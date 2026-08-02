function configuredEmails(): Set<string> {
  return new Set(
    (process.env.ALLOWED_USER_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLocaleLowerCase('en-US'))
      .filter(Boolean),
  )
}

/** O MVP e single-user. Em producao, allowlist ausente bloqueia por seguranca. */
export function isAllowedUserEmail(email: unknown): boolean {
  const allowed = configuredEmails()
  if (allowed.size === 0) return process.env.NODE_ENV !== 'production'
  return typeof email === 'string' && allowed.has(email.toLocaleLowerCase('en-US'))
}
