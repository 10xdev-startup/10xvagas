import type { NextFunction, Request, Response } from 'express'
import { JobModel } from '@/models/JobModel'
import { AppError } from '@/utils/AppError'
import { isUUID } from '@/utils/slugify'

export async function resolveJobIdParam(
  req: Request,
  _res: Response,
  next: NextFunction,
  value: string,
): Promise<void> {
  try {
    if (isUUID(value)) {
      req.params['id'] = value.toLowerCase()
      next()
      return
    }

    const result = await JobModel.resolveId(value)
    if (result.status === 'ambiguous') {
      console.error('[jobs] Slug ambiguo; nenhum candidato foi escolhido.', {
        slug: value,
        ids: result.ids,
      })
      next(new AppError(404, 'Vaga nao encontrada', 'JOB_NOT_FOUND'))
      return
    }
    if (result.status === 'not_found') {
      next(new AppError(404, 'Vaga nao encontrada', 'JOB_NOT_FOUND'))
      return
    }

    req.params['id'] = result.id
    next()
  } catch (error) {
    next(error)
  }
}
