import { Router } from 'express'
import { SavedJobController } from '@/controllers/SavedJobController'
import { supabaseMiddleware } from '@/middleware'

const router = Router()

router.use(supabaseMiddleware)
router.get('/', SavedJobController.list)
router.post('/', SavedJobController.save)
router.delete('/:jobKey', SavedJobController.remove)

export { router as savedJobRoutes }
