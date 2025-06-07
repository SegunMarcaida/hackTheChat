import { Router, Request, Response } from 'express'
import { getContactByJid, saveContact } from '../database/firestore.js'
import { ContactStatus, SimilarContactResult } from '../interfaces.js'
import { createLogger } from '../logger/index.js'
import { getSocket } from '../socket/manager.js'
import { generateCallFinishedMessage } from '../ai/openai.js'
import { handleAuth0Publicity } from '../handlers/welcomeFlow.js'
import admin from 'firebase-admin'
import { findTopMatch } from '../database/vectorSearch.js'

const router = Router()
const logger = createLogger('FinishedAPI')

// POST /api/finished - Marcar llamada como terminada y enviar mensaje de seguimiento
router.post('/api/finished', async (req: Request, res: Response) => {
    try {
        const { jid } = req.body
        
        if (!jid) {
            return res.status(400).json({
                success: false,
                error: 'JID parameter is required'
            })
        }

        // Obtener el socket de WhatsApp
        const sock = getSocket()
        if (!sock) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp connection not available'
            })
        }

        // Obtener información del contacto
        const contact = await getContactByJid(jid)
        if (!contact) {
            return res.status(404).json({
                success: false,
                error: 'Contact not found'
            })
        }

        // Actualizar el status del contacto a CALL_FINISHED
        await saveContact({
            jid: contact.id,
            name: contact.name,
            number: contact.number,
            email: contact.email,
            linkedinProfile: contact.linkedinProfile,
            status: ContactStatus.CALL_FINISHED,
            callPermission: contact.callPermission,
            callScheduled: contact.callScheduled,
            lastMessageAt: admin.firestore.Timestamp.now()
        })

        // Generar mensaje personalizado usando AI

        const topMatch = await findTopMatch(contact.embedding || [])
        if (topMatch) {
            logger.info('✨ Top match found', {
                jid: topMatch.contact.jid,
                contactName: topMatch.contact.name,
                similarity: topMatch.similarity
            })
        }

        const followUpMessage = await generateFollowUpMessage(contact.name, topMatch)
        
        // Enviar mensaje de seguimiento
        await sock.sendMessage(jid, { text: followUpMessage })

        logger.info('✅ Call finished message sent', {
            jid,
            contactName: contact.name,
            messageLength: followUpMessage.length
        })

        // Esperar un momento antes de enviar la publicidad de Auth0
        setTimeout(async () => {
            try {
                await handleAuth0Publicity(sock, jid, contact.name)
                logger.info('✅ Auth0 publicity process initiated', { jid, contactName: contact.name })
            } catch (error) {
                logger.error('❌ Error sending Auth0 publicity', error, { jid })
            }
        }, 3000) // 3 segundos de delay

        logger.info('✅ Call marked as finished and follow-up flow initiated', {
            jid,
            contactName: contact.name,
            messageLength: followUpMessage.length
        })

        res.json({
            success: true,
            data: {
                jid,
                contactName: contact.name,
                status: ContactStatus.CALL_FINISHED,
                messageSent: true,
                message: followUpMessage
            }
        })
    } catch (error) {
        logger.error('❌ Error processing finished call', error)
        res.status(500).json({
            success: false,
            error: 'Failed to process finished call'
        })
    }
})

/**
 * Genera un mensaje de seguimiento personalizado después de la llamada usando AI
 */
async function generateFollowUpMessage(contactName: string | null, topMatch: SimilarContactResult | null): Promise<string> {
    try {
        // Intentar generar mensaje con AI
        const aiMessage = await generateCallFinishedMessage(contactName, topMatch)
        
        if (aiMessage && aiMessage.trim()) {
            logger.info('✨ AI-generated call finished message', { 
                contactName, 
                length: aiMessage.length 
            })
            return aiMessage
        } else {
            throw new Error('AI returned empty message')
        }
    } catch (error) {
        logger.warn('AI message generation failed for call finished, using fallback', error)
        
        // Fallback al mensaje estático
        return generateStaticFollowUpMessage(contactName)
    }
}

/**
 * Genera un mensaje estático de fallback
 */
function generateStaticFollowUpMessage(contactName: string | null): string {
    const name = contactName || 'there'
    
    return `¡Hola ${name}! 

Me gustó mucho nuestra charla de hoy. Fue genial conocer más sobre tu experiencia y tus proyectos. 

Ahora estoy analizando toda la información que compartiste conmigo para poder conectarte con los mejores contactos de mi red que realmente puedan ayudarte a avanzar en tus objetivos.

Te estaré contactando pronto con algunas conexiones estratégicas que creo que serán muy valiosas para ti.

¡Gracias por tu tiempo y espero que estas conexiones te sean de gran ayuda! 🚀`
}

export default router 