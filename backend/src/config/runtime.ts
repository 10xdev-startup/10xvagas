function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name}_INVALID`)
  return value
}

export function getHttpRuntimeConfig(): {
  checkoutRateLimitMax: number
  generalRateLimitMax: number
  profileAnalysisRateLimitMax: number
  rateLimitWindowMs: number
  responseTimeoutMs: number
} {
  return {
    checkoutRateLimitMax: positiveInteger('CHECKOUT_RATE_LIMIT_MAX', 10),
    generalRateLimitMax: positiveInteger('RATE_LIMIT_MAX_REQUESTS', 300),
    profileAnalysisRateLimitMax: positiveInteger('PROFILE_ANALYSIS_RATE_LIMIT_MAX', 10),
    rateLimitWindowMs: positiveInteger('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    responseTimeoutMs: positiveInteger('RESPONSE_TIMEOUT_MS', 30_000),
  }
}

export function getProfileAnalysisMinimumCreditsCents(): number {
  return positiveInteger('PROFILE_ANALYSIS_MIN_CREDITS_CENTS', 5)
}
