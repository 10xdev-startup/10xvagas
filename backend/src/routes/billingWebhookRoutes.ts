import { Router, raw } from 'express'
import { BillingController } from '@/controllers/BillingController'

const router = Router()

router.post('/', raw({ type: 'application/json', limit: '100kb' }), BillingController.webhook)

export { router as billingWebhookRoutes }
