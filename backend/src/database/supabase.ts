import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { WebSocketLikeConstructor } from '@supabase/realtime-js'
import dotenv from 'dotenv'
import WebSocket from 'ws'

dotenv.config({ quiet: true })

let client: SupabaseClient | null = null

// Cria o client sob demanda. As credenciais so sao exigidas no primeiro uso
// real do banco — nao no boot do processo.
function getClient(): SupabaseClient {
  if (client) return client
  const supabaseUrl = process.env['SUPABASE_URL']
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios')
  }
  client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor },
  })
  return client
}

// Proxy lazy: o client real so e inicializado (e as credenciais cobradas) no
// primeiro acesso a uma propriedade, ex. `supabase.from(...)` ou `supabase.auth`.
// Assim o backend sobe sem Supabase configurado (ex.: apenas /health) e so falha
// se uma rota que de fato usa o banco for chamada.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient()
    const value = Reflect.get(c, prop, c)
    return typeof value === 'function' ? value.bind(c) : value
  },
})
