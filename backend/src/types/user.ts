/** Papel global do usuario no sistema. Edite a union para adicionar papeis. */
export type UserRole = 'user' | 'admin'

/** Linha da tabela `users` no Supabase (snake_case — espelha o banco). */
export interface UserRow {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  role: UserRole
  status: string
  stripe_customer_id: string | null
  onboarded_at: string | null
  created_at: string
  updated_at: string
}

/** Usuario exposto pela API (camelCase) — o que o frontend recebe. */
export interface User {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  role: UserRole
  onboardedAt: string | null
  createdAt: string
}

/** Forma anexada em `req.user` pelo supabaseMiddleware (perfil minimo p/ autorizacao). */
export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: UserRole
  status: string
  avatarUrl: string | null
}

/** Mapeia a linha do banco (snake_case) para o contrato da API (camelCase). */
export function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    role: row.role,
    onboardedAt: row.onboarded_at,
    createdAt: row.created_at,
  }
}
