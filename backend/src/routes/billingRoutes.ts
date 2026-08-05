import { Router } from 'express'
import { BillingController } from '@/controllers/BillingController'
import { checkoutRateLimit, supabaseMiddleware } from '@/middleware'

const router = Router()

router.use(supabaseMiddleware)
router.get('/status', BillingController.status)
router.post('/checkout', checkoutRateLimit, BillingController.checkout)

export { router as billingRoutes }
