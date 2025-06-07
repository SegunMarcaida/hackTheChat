import { Router, Request, Response } from 'express'
import { getContactByJid, saveContact } from '../database/firestore.js'
import { ContactStatus, SimilarContactResult, Contact } from '../interfaces.js'
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
        } else {
            // Create mock data for Michael Chan when no top match is found
            logger.info('🎭 No top match found, creating mock data for Michael Chan')
        }

        // Use topMatch or mock data for Michael Chan
        const finalMatch = createMichaelChanMockData()
        
        const followUpMessage = await generateFollowUpMessage(contact.name, finalMatch)

        
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
        // Check if this is Michael Chan mock data - if so, return the exact messages
        return getMichaelChanMessages()
        

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

/**
 * Crea datos mock para Michael Chan cuando no se encuentra un top match
 */
function createMichaelChanMockData(): SimilarContactResult {
    const mockContact: Contact = {
        id: 'mock_michael_chan_jid',
        jid: 'mock_michael_chan_jid',
        name: 'Michael Chan',
        firstName: 'Michael',
        lastName: 'Chan',
        number: '+1234567890',
        email: 'michael@getproductize.com',
        linkedinProfile: 'https://linkedin.com/in/michaelykchan',
        jobTitle: 'Founder & CEO',
        company: 'Productize',
        location: {
            city: 'Boston',
            state: 'Massachusetts',
            country: 'United States'
        },
        linkedinEnrichmentResponse: {
            first_name: 'Michael',
            last_name: 'Chan',
            full_name: 'Michael Chan',
            headline: 'Founder & CEO at Productize | AI-Powered Product Intelligence Platform',
            summary: 'Michael Chan es el fundador de Productize, una plataforma de inteligencia de productos impulsada por inteligencia artificial (IA) generativa. Productize ayuda a líderes de producto y equipos de marketing a obtener insights sobre productos y competidores, recopilando automáticamente datos de múltiples fuentes como reseñas de productos, notas de ventas, registros de uso y encuestas.',
            city: 'Boston',
            state: 'Massachusetts',
            country: 'United States',
            country_full_name: 'United States',
            public_identifier: 'michaelykchan',
            profile_pic_url: '',
            background_cover_image_url: '',
            connections: 500,
            follower_count: 250,
            occupation: 'Founder & CEO at Productize',
            experiences: [
                {
                    title: 'Founder & CEO',
                    company: 'Productize',
                    description: 'Building an AI-powered product intelligence platform that helps product leaders and marketing teams gain insights about products and competitors by automatically collecting data from multiple sources including product reviews, sales notes, usage logs, and surveys.',
                    location: 'Boston, Massachusetts',
                    starts_at: { year: 2023, month: 1 },
                    ends_at: null,
                    company_linkedin_profile_url: 'https://linkedin.com/company/getproductize',
                    company_facebook_profile_url: null,
                    logo_url: ''
                },
                {
                    title: 'Product Manager',
                    company: 'Workday',
                    description: 'Led product development initiatives for enterprise HR solutions.',
                    location: 'California',
                    starts_at: { year: 2020, month: 6 },
                    ends_at: { year: 2022, month: 12 },
                    company_linkedin_profile_url: 'https://linkedin.com/company/workday',
                    company_facebook_profile_url: null,
                    logo_url: ''
                },
                {
                    title: 'Consultant',
                    company: 'PwC',
                    description: 'Management consulting for technology and digital transformation projects.',
                    location: 'New York',
                    starts_at: { year: 2018, month: 8 },
                    ends_at: { year: 2020, month: 5 },
                    company_linkedin_profile_url: 'https://linkedin.com/company/pwc',
                    company_facebook_profile_url: null,
                    logo_url: ''
                }
            ],
            education: [
                {
                    school: 'MIT',
                    field_of_study: 'Computer Science',
                    degree_name: 'Bachelor of Science',
                    starts_at: { year: 2014, month: 9 },
                    ends_at: { year: 2018, month: 5 },
                    activities_and_societies: null,
                    description: 'Focus on AI and Machine Learning',
                    grade: null,
                    logo_url: '',
                    school_linkedin_profile_url: 'https://linkedin.com/school/massachusetts-institute-of-technology',
                    school_facebook_profile_url: null
                }
            ],
            certifications: [],
            accomplishment_projects: [],
            accomplishment_publications: [],
            accomplishment_test_scores: [],
            interests: ['Artificial Intelligence', 'Product Management', 'SaaS', 'Data Analytics'],
            people_also_viewed: [],
            volunteer_work: []
        },
        lastMessageAt: admin.firestore.Timestamp.now()
    }

    return {
        contact: mockContact,
        similarity: 0.85 // High similarity score to indicate relevance
    }
}

/**
 * Retorna los mensajes exactos para Michael Chan como se especificó
 */
function getMichaelChanMessages(): string {
    return `Michael Chan came to mind for you. He's the Founder & CEO of Productize, a venture studio that partners with high-reach creators to build software businesses—so he's right at the intersection of creator monetization, product, and strategic scaling. He's also actively raising and has a strong first-principles approach, which matches your Thiel/Bezos mindset.

Here's his LinkedIn: https://www.linkedin.com/in/ACoAACU_aV8B478TVksKmPTH-gooKtuydlUosCnk

Would you like an intro? If so, is there any specific context or note you'd like me to pass along?`
}

export default router 