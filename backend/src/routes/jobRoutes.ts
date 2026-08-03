import { Router } from 'express'
import { JobController } from '@/controllers/JobController'
import { supabaseMiddleware } from '@/middleware'
import { resolveJobIdParam } from '@/routes/jobRouteParams'

const router = Router()

router.use(supabaseMiddleware)
router.param('id', resolveJobIdParam)
router.get('/', JobController.list)
router.get('/:id', JobController.getById)

export { router as jobRoutes }
