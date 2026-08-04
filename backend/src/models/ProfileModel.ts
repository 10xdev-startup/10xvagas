import { supabase } from '@/database/supabase'
import type { ProfileRow } from '@/types/profile'

const TABLE = 'profile'
const COLUMNS = 'user_id, document'

/** Perfil Canonico privado. Como o cliente usa service-role, toda leitura filtra pelo dono. */
export const ProfileModel = {
  async findByUser(userId: string): Promise<ProfileRow | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select(COLUMNS)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return (data as ProfileRow | null) ?? null
  },
}
