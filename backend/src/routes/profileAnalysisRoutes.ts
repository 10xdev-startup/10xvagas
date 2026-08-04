import { Router } from 'express'
import multer from 'multer'
import { ProfileAnalysisController } from '@/controllers/ProfileAnalysisController'
import { profileAnalysisRateLimit, supabaseMiddleware } from '@/middleware'
import { PROFILE_DOCUMENT_MAX_BYTES } from '@/services/profileDocumentService'
import { AppError } from '@/utils/AppError'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: PROFILE_DOCUMENT_MAX_BYTES, files: 1, fields: 5 } })

router.use(supabaseMiddleware)
router.post('/', profileAnalysisRateLimit, (req, res, next) => {
  upload.single('document')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(413, 'O curriculo deve ter no maximo 8 MB', 'DOCUMENT_TOO_LARGE'))
      return
    }
    if (error) {
      next(new AppError(422, 'Nao foi possivel ler o upload', 'INVALID_MULTIPART_UPLOAD'))
      return
    }
    next()
  })
}, ProfileAnalysisController.create)
router.get('/', ProfileAnalysisController.list)
router.get('/:id', ProfileAnalysisController.get)
router.post('/:id/cancel', ProfileAnalysisController.cancel)
router.post('/:id/retry', ProfileAnalysisController.retry)
router.post('/:id/approve', ProfileAnalysisController.approve)

export { router as profileAnalysisRoutes }
