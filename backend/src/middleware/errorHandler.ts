import type { Request, Response, NextFunction } from 'express'
import { AppError } from '@/utils/AppError'
import { sendError } from '@/utils/apiResponse'

/**
 * Handler de erro central — registre por ULTIMO (`app.use(errorHandler)`), depois das
 * rotas. O Express 5 encaminha rejeicoes de handlers async pra ca automaticamente.
 *
 * `AppError` (erro esperado) vira a resposta com seu status/code; qualquer outro erro
 * vira 500 generico. Mantem TODA resposta no envelope wrapped (`sendError`).
 *
 * Assinatura de 4 args (com `_next`) e obrigatoria pro Express reconhecer como
 * error handler.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) {
    _next(err)
    return
  }
  if (err instanceof AppError) {
    sendError(res, err.status, err.message, err.code)
    return
  }
  console.error('[errorHandler]', err instanceof Error ? (err.stack ?? err.message) : err)
  sendError(res, 500, 'Erro interno do servidor', 'INTERNAL_ERROR')
}
