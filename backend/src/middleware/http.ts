import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { getHttpRuntimeConfig } from '@/config/runtime'
import { sendError } from '@/utils/apiResponse'

function rateLimitHandler(_req: Request, res: Response): void {
  sendError(res, 429, 'Muitas requisicoes. Tente novamente em alguns instantes.', 'RATE_LIMITED')
}

const runtime = getHttpRuntimeConfig()

export const generalRateLimit = rateLimit({
  handler: rateLimitHandler,
  legacyHeaders: false,
  limit: runtime.generalRateLimitMax,
  standardHeaders: 'draft-7',
  windowMs: runtime.rateLimitWindowMs,
})

export const checkoutRateLimit = rateLimit({
  handler: rateLimitHandler,
  legacyHeaders: false,
  limit: runtime.checkoutRateLimitMax,
  standardHeaders: 'draft-7',
  windowMs: runtime.rateLimitWindowMs,
})

export const profileAnalysisRateLimit = rateLimit({
  handler: rateLimitHandler,
  legacyHeaders: false,
  limit: runtime.profileAnalysisRateLimitMax,
  standardHeaders: 'draft-7',
  windowMs: 60 * 60 * 1000,
})

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID()
  req.headers['x-request-id'] = requestId
  res.setHeader('X-Request-ID', requestId)
  res.setTimeout(runtime.responseTimeoutMs, () => {
    console.error('[http] tempo limite da resposta excedido', {
      method: req.method,
      path: req.originalUrl,
      requestId,
    })
    if (!res.headersSent) sendError(res, 504, 'Servidor demorou para responder', 'RESPONSE_TIMEOUT')
  })
  next()
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, `Rota ${req.method} ${req.originalUrl} nao encontrada`, 'ROUTE_NOT_FOUND')
}
