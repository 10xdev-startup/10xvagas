import type { Request, Response, NextFunction } from 'express'
import { supabase } from '@/database/supabase'
import { UserModel } from '@/models/UserModel'
import { sendError } from '@/utils/apiResponse'
import type { AuthUser } from '@/types/user'

// Augmenta o Request do Express com o usuario autenticado — disponivel (tipado) em
// todo controller depois deste middleware.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

/**
 * Valida o Bearer JWT do Supabase, garante o perfil em `users` e injeta `req.user`.
 *
 * Usa o metodo oficial `auth.getUser(token)` (verifica assinatura, expiracao e
 * revogacao sem precisar de JWT_SECRET/JWKS). Bloqueia 401 sem token valido; cria
 * um perfil default no primeiro login (role `user`); bloqueia 403 se a conta nao
 * estiver `active`. Toda resposta de erro vai no envelope wrapped via `sendError`.
 */
export async function supabaseMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 401, 'Token de acesso requerido', 'AUTH_REQUIRED')
    return
  }

  const token = authHeader.substring(7)
  const { data, error } = await supabase.auth.getUser(token)
  const authUser = data.user
  if (error || !authUser) {
    sendError(res, 401, 'Token invalido ou expirado', 'AUTH_INVALID')
    return
  }

  // Garante a linha do perfil (cria no primeiro acesso).
  let row = await UserModel.findById(authUser.id)
  if (!row) {
    const email = authUser.email?.toLowerCase() ?? ''
    const meta = authUser.user_metadata
    const name =
      (typeof meta.name === 'string' && meta.name) ||
      (typeof meta.full_name === 'string' && meta.full_name) ||
      email.split('@')[0] ||
      null
    const avatarUrl = typeof meta.avatar_url === 'string' ? meta.avatar_url : null
    row = await UserModel.upsertFromAuth({ id: authUser.id, email, name, avatarUrl })
  }

  if (row.status !== 'active') {
    sendError(res, 403, 'Conta desativada. Contate um administrador.', 'ACCOUNT_DISABLED')
    return
  }

  req.user = {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    avatarUrl: row.avatar_url,
  }
  next()
}
