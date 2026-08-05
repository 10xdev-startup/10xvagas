import { Router } from 'express'
import { ProfileController } from '@/controllers/ProfileController'
import { supabaseMiddleware } from '@/middleware'

const router = Router()

router.use(supabaseMiddleware)
router.get('/', ProfileController.get)

export { router as profileRoutes }
