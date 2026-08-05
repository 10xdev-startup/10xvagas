import { supabase } from '@/database/supabase'
import type { UserRole, UserRow } from '@/types/user'

const TABLE = 'users'
const COLUMNS =
  'id, email, name, avatar_url, role, status, stripe_customer_id, onboarded_at, created_at, updated_at'

export interface UpsertUserInput {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  role?: UserRole
}

/**
 * Acesso a tabela `users` (camada Model — Controller → Model → Database). Usa o
 * cliente service-role (bypassa RLS). Lanca `Error` em falha do banco; o controller
 * deixa propagar e o `errorHandler` central responde 500 no envelope wrapped.
 */
export const UserModel = {
  async findById(id: string): Promise<UserRow | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as UserRow | null) ?? null
  },

  /** Cria/garante a linha do perfil a partir dos dados do Supabase Auth (idempotente). */
  async upsertFromAuth(input: UpsertUserInput): Promise<UserRow> {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(
        {
          id: input.id,
          email: input.email,
          name: input.name,
          avatar_url: input.avatarUrl,
          role: input.role ?? 'user',
          status: 'active',
          created_at: now,
          updated_at: now,
        },
        { onConflict: 'id' },
      )
      .select(COLUMNS)
      .single()
    if (error) throw new Error(error.message)
    return data as UserRow
  },

  /** Marca o onboarding como concluido. */
  async markOnboarded(id: string): Promise<UserRow> {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from(TABLE)
      .update({ onboarded_at: now, updated_at: now })
      .eq('id', id)
      .select(COLUMNS)
      .single()
    if (error) throw new Error(error.message)
    return data as UserRow
  },

  /** Atualiza campos do proprio usuario (so os fornecidos). */
  async update(
    id: string,
    patch: { name?: string | null; avatarUrl?: string | null },
  ): Promise<UserRow> {
    const fields: Record<string, string | null> = {
      updated_at: new Date().toISOString(),
    }
    if (patch.name !== undefined) fields['name'] = patch.name
    if (patch.avatarUrl !== undefined) fields['avatar_url'] = patch.avatarUrl

    const { data, error } = await supabase
      .from(TABLE)
      .update(fields)
      .eq('id', id)
      .select(COLUMNS)
      .single()
    if (error) throw new Error(error.message)
    return data as UserRow
  },
}
