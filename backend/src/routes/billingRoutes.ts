import { Router } from 'express'
import { BillingController } from '@/controllers/BillingController'
import { supabaseMiddleware } from '@/middleware'

const router = Router()

router.use(supabaseMiddleware)
router.get('/status', BillingController.status)
router.post('/checkout', BillingController.checkout)

export { router as billingRoutes }
