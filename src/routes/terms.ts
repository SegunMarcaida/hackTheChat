import { Router, Request, Response } from 'express'

const router = Router()

router.get('/terms', (req: Request, res: Response) => {
    const currentDate = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
    
    res.render('terms', {
        title: 'Términos y Condiciones de Servicio',
        layout: 'terms-layout',
        currentDate: currentDate
    })
})

export default router 