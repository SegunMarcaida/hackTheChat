import { Contact } from '../interfaces.js'
import { vectorizeContact, getVectorizedContact, revectorizeContact } from '../database/vectorDatabase.js'
import { createLogger } from '../logger/index.js'

const logger = createLogger('AutoVectorization')

/**
 * Vectoriza automáticamente un contacto si tiene información suficiente
 * @param contact - Contacto a evaluar para vectorización
 * @returns true si se vectorizó el contacto
 */
export async function autoVectorizeContact(contact: Contact): Promise<boolean> {
    try {
        // Verificar si el contacto ya está vectorizado
        const existingVectorized = await getVectorizedContact(contact.jid)
        if (existingVectorized) {
            // Si ya existe, verificar si necesita actualización
            return await revectorizeContact(contact)
        }

        // Verificar si tiene información suficiente para vectorizar
        const hasLinkedInData = contact.linkedinData && (
            contact.linkedinData.headline || 
            contact.linkedinData.company || 
            contact.linkedinData.experience
        )
        
        const hasEmail = contact.email && contact.email.includes('@')

        if (!hasLinkedInData && !hasEmail) {
            logger.debug('Contact lacks sufficient information for vectorization', {
                jid: contact.jid,
                name: contact.name,
                hasLinkedIn: !!contact.linkedinData,
                hasEmail: !!contact.email
            })
            return false
        }

        // Intentar vectorizar el contacto
        const success = await vectorizeContact(contact)
        
        if (success) {
            logger.info('✅ Contact auto-vectorized successfully', {
                jid: contact.jid,
                name: contact.name
            })
        } else {
            logger.warn('❌ Failed to auto-vectorize contact', {
                jid: contact.jid,
                name: contact.name
            })
        }

        return success

    } catch (error) {
        logger.error('❌ Error in auto-vectorization', error, {
            jid: contact.jid,
            name: contact.name
        })
        return false
    }
}

/**
 * Verifica si un contacto necesita ser re-vectorizado
 * @param contact - Contacto a verificar
 * @returns true si necesita re-vectorización
 */
export async function needsRevectorization(contact: Contact): Promise<boolean> {
    try {
        const existingVectorized = await getVectorizedContact(contact.jid)
        
        // Si no existe vector, necesita vectorización inicial
        if (!existingVectorized) {
            return true
        }

        // Si tiene nueva información de LinkedIn pero no se ha vectorizado desde entonces
        if (contact.linkedinData?.searchedAt && existingVectorized.vectorizedAt) {
            const linkedinUpdated = contact.linkedinData.searchedAt.toMillis() > existingVectorized.vectorizedAt.toMillis()
            if (linkedinUpdated) {
                return true
            }
        }

        // Si usa una versión antigua del modelo de embedding
        if (existingVectorized.vectorVersion !== 'text-embedding-3-small') {
            return true
        }

        return false

    } catch (error) {
        logger.error('❌ Error checking revectorization needs', error, { jid: contact.jid })
        return false
    }
}

/**
 * Vectoriza en batch todos los contactos que necesitan actualización
 * @param limit - Límite de contactos a procesar
 * @returns Número de contactos procesados
 */
export async function autoVectorizeUpdatedContacts(limit: number = 20): Promise<number> {
    try {
        // Esta función se puede ejecutar periódicamente para mantener 
        // actualizados los vectores de contactos con nueva información
        
        logger.info('Starting auto-vectorization batch process', { limit })
        
        // Por ahora, delegar al vectorizeAllContacts que ya maneja la lógica
        // En el futuro se puede implementar lógica más sofisticada aquí
        const { vectorizeAllContacts } = await import('../database/vectorDatabase.js')
        const processed = await vectorizeAllContacts(limit)
        
        logger.info('Auto-vectorization batch completed', { 
            limit, 
            processed 
        })
        
        return processed

    } catch (error) {
        logger.error('❌ Error in auto-vectorization batch', error)
        return 0
    }
}

/**
 * Programa la auto-vectorización para ejecutarse periódicamente
 * @param intervalMinutes - Intervalo en minutos para ejecutar la auto-vectorización
 */
export function scheduleAutoVectorization(intervalMinutes: number = 60): void {
    const intervalMs = intervalMinutes * 60 * 1000

    logger.info('Scheduling auto-vectorization', { 
        intervalMinutes,
        nextRun: new Date(Date.now() + intervalMs).toISOString()
    })

    setInterval(async () => {
        try {
            logger.info('Running scheduled auto-vectorization')
            const processed = await autoVectorizeUpdatedContacts(10)
            logger.info('Scheduled auto-vectorization completed', { processed })
        } catch (error) {
            logger.error('❌ Error in scheduled auto-vectorization', error)
        }
    }, intervalMs)
}

/**
 * Evalúa la calidad de la información de un contacto para vectorización
 * @param contact - Contacto a evaluar
 * @returns Puntuación de calidad (0-1) y detalles
 */
export function evaluateContactQuality(contact: Contact): {
    score: number
    details: {
        hasName: boolean
        hasEmail: boolean
        hasLinkedInProfile: boolean
        hasLinkedInData: boolean
        hasCompanyInfo: boolean
        hasExperience: boolean
        hasEducation: boolean
    }
} {
    const details = {
        hasName: !!contact.name,
        hasEmail: !!contact.email,
        hasLinkedInProfile: !!contact.linkedinProfile,
        hasLinkedInData: !!contact.linkedinData,
        hasCompanyInfo: !!(contact.linkedinData?.company || contact.linkedinData?.headline),
        hasExperience: !!(contact.linkedinData?.experience && contact.linkedinData.experience.length > 0),
        hasEducation: !!(contact.linkedinData?.education && contact.linkedinData.education.length > 0)
    }

    // Calcular puntuación basada en la información disponible
    let score = 0
    
    // Información básica (peso menor)
    if (details.hasName) score += 0.1
    if (details.hasEmail) score += 0.2
    
    // Información de LinkedIn (peso mayor)
    if (details.hasLinkedInProfile) score += 0.1
    if (details.hasLinkedInData) score += 0.2
    if (details.hasCompanyInfo) score += 0.2
    if (details.hasExperience) score += 0.1
    if (details.hasEducation) score += 0.1

    return {
        score: Math.min(score, 1.0), // Asegurar que no exceda 1.0
        details
    }
} 