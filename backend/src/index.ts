import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { sendError, sendOk } from '@/utils/apiResponse'
import { userRoutes } from '@/routes/userRoutes'
import { savedJobRoutes } from '@/routes/savedJobRoutes'
import { jobRoutes } from '@/routes/jobRoutes'
import { billingRoutes } from '@/routes/billingRoutes'
import { billingWebhookRoutes } from '@/routes/billingWebhookRoutes'
import { errorHandler } from '@/middleware'
import { supabase } from '@/database/supabase'

dotenv.config({ quiet: true })

const app = express()
const PORT = process.env['PORT'] || 3001
const allowedOrigins = new Set(
  (process.env['CORS_ORIGINS'] ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

app.disable('x-powered-by')
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) callback(null, true)
    else callback(null, false)
  },
}))

// A assinatura Stripe exige os bytes originais. Monte antes do parser JSON global.
app.use('/billing/webhook', billingWebhookRoutes)
app.use(express.json({ limit: '100kb' }))

app.get('/health', (_req, res) => {
  // Envelope wrapped (blueprint §4): todo controller responde via sendOk/sendError.
  sendOk(res, { status: 'ok' })
})

app.get('/ready', async (_req, res) => {
  const [users, savedJobs, jobs, jobMatches, sourceRuns] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('saved_job').select('id', { count: 'exact', head: true }),
    supabase.from('job').select('id', { count: 'exact', head: true }),
    supabase.from('job_match').select('job_id', { count: 'exact', head: true }),
    supabase.from('source_run').select('id', { count: 'exact', head: true }),
  ])
  if (users.error || savedJobs.error || jobs.error || jobMatches.error || sourceRuns.error) {
    sendError(res, 503, 'Banco ainda nao esta pronto para trafego autenticado.', 'DATABASE_NOT_READY')
    return
  }
  sendOk(res, { status: 'ready' })
})

// Dominio de referencia: usuario (Controller → Model → Database).
app.use('/users', userRoutes)
app.use('/saved-jobs', savedJobRoutes)
app.use('/jobs', jobRoutes)
app.use('/billing', billingRoutes)

// Handler de erro central — por ULTIMO, depois das rotas (serializa AppError no envelope).
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Server rodando na porta ${PORT}`)
})
