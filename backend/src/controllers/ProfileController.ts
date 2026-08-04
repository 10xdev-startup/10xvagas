import type { Request, Response } from 'express'
import { ProfileModel } from '@/models/ProfileModel'
import { toPublicProfile } from '@/types/profile'
import { AppError } from '@/utils/AppError'
import { sendOk } from '@/utils/apiResponse'

export const ProfileController = {
  async get(req: Request, res: Response): Promise<void> {
    const user = req.user
    if (!user) throw new AppError(401, 'Nao autenticado', 'AUTH_REQUIRED')
    const row = await ProfileModel.findByUser(user.id)
    sendOk(res, { profile: row ? toPublicProfile(row) : null })
  },
}
