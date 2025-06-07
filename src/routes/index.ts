import { Router } from 'express'

import authRouter from './auth.js'
import dashboardRouter from './dashboard.js'
import qrRouter from './qr.js'
import contactsRouter from './contacts.js'
import contactEnrichmentRouter from './contact-enrichment.js'
import termsRouter from './terms.js'
import finishedRouter from './finished.js'

const router = Router()

router.use(authRouter)
router.use(dashboardRouter)
router.use(qrRouter)
router.use(contactsRouter)
router.use(contactEnrichmentRouter)
router.use(termsRouter)
router.use(finishedRouter)

export default router
