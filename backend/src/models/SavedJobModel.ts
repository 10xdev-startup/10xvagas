import { supabase } from '@/database/supabase'
import type { SavedJobRow, SavedJobSnapshot } from '@/types/savedJob'

const TABLE = 'saved_job'
const COLUMNS = 'id, user_id, job_key, snapshot, created_at, updated_at'

export interface SaveJobInput {
  userId: string
  jobKey: string
  snapshot: SavedJobSnapshot
}

/** Acesso a vagas salvas. Toda query inclui `user_id`, inclusive usando service-role. */
export const SavedJobModel = {
  async listByUser(userId: string): Promise<SavedJobRow[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select(COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data as SavedJobRow[] | null) ?? []
  },

  /** Upsert idempotente; requer unique constraint em `(user_id, job_key)`. */
  async save(input: SaveJobInput): Promise<SavedJobRow> {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(
        {
          user_id: input.userId,
          job_key: input.jobKey,
          snapshot: input.snapshot,
          updated_at: now,
        },
        { onConflict: 'user_id,job_key' },
      )
      .select(COLUMNS)
      .single()
    if (error) throw new Error(error.message)
    return data as SavedJobRow
  },

  /** Remocao idempotente: `false` significa que a vaga ja nao estava salva. */
  async remove(userId: string, jobKey: string): Promise<boolean> {
    const { data, error } = await supabase
      .from(TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('job_key', jobKey)
      .select('id')
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data !== null
  },
}
