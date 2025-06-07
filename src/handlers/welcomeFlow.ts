import { WASocket } from 'baileys'
import { ContactStatus } from '../interfaces.js'
import { getContactByJid, saveContact } from '../database/firestore.js'
import { createLogger } from '../logger/index.js'
import { welcomeFlowConfig, validateEmail } from '../config/welcomeFlow.js'
import { CONSTANTS } from '../config/constants.js'
import { 
    generateWelcomeMessage, 
    generateEmailRequest, 
    generateEmailConfirmation, 
    generateEmailErrorMessage,
    generateLinkedInFoundMessage,
    generateLinkedInNotFoundMessage,
    generateCallSchedulingMessage,
    generateCallDeclinedMessage
} from '../ai/openai.js'
import { searchLinkedInProfile } from '../services/linkedinService.js'
import { scheduleCall } from '../services/callingService.js'
import admin from 'firebase-admin'

const logger = createLogger('WelcomeFlow')

// Terms and conditions link
const termsAndConditionsLink = CONSTANTS.TERMS_AND_CONDITIONS_URL

/**
 * Procesa el flujo de bienvenida para un contacto
 * @param sock - Socket de WhatsApp
 * @param jid - JID del contacto
 * @param contactName - Nombre del contacto
 * @param messageText - Texto del mensaje recibido
 * @returns true si el mensaje fue procesado por el flujo de bienvenida
 */
export async function processWelcomeFlow(
    sock: WASocket,
    jid: string,
    contactName: string | null,
    messageText: string
): Promise<boolean> {
    try {
        // Verificar si el flujo de bienvenida está habilitado
        if (!welcomeFlowConfig.enabled) {
            return false
        }

        // Verificar si debe procesar grupos
        const isGroup = jid.endsWith('@g.us')
        if (isGroup && !welcomeFlowConfig.behavior.processGroups) {
            return false
        }

        // Obtener información del contacto desde la base de datos
        const contact = await getContactByJid(jid)
        
        // Si es un contacto nuevo (no existe en la BD)
        if (!contact) {
            await handleNewContact(sock, jid, contactName)
            return true
        }

        // Si el contacto existe, verificar su estado en el flujo
        const status = contact.status || ContactStatus.NEW

        switch (status) {
            case ContactStatus.NEW:
            case ContactStatus.WELCOME_SENT:
                await handleWelcomeSent(sock, jid, contactName, messageText)
                return true

            case ContactStatus.WAITING_EMAIL:
                await handleEmailResponse(sock, jid, contactName, messageText)
                return true

            case ContactStatus.EMAIL_RECEIVED:
                // Estado transitorio - no debería recibir mensajes aquí
                return true

            case ContactStatus.LINKEDIN_FOUND:
            case ContactStatus.WAITING_CALL_PERMISSION:
                await handleCallPermissionResponse(sock, jid, contactName, messageText)
                return true

            case ContactStatus.CALL_SCHEDULED:
            case ContactStatus.COMPLETED:
                // Flujo completado, no intervenir
                return false

            default:
                logger.warn('Unknown contact status', { jid, status })
                return false
        }
    } catch (error) {
        logger.error('Error in welcome flow', error, { jid, contactName })
        return false
    }
}

/**
 * Maneja un contacto completamente nuevo
 */
async function handleNewContact(sock: WASocket, jid: string, contactName: string | null) {
    logger.info('🆕 New contact detected, starting welcome flow', { jid, contactName })

    // Crear el contacto en la base de datos con estado NEW
    await saveContact({
        jid,
        name: contactName,
        number: jid.split('@')[0],
        status: ContactStatus.WELCOME_SENT,
        lastMessageAt: admin.firestore.Timestamp.now()
    })

    // Generar y enviar mensaje de bienvenida
    const welcomeMessage = await generateMessage(
        'welcome',
        contactName,
        jid.split('@')[0],
        null,
        null
    )
    
    await sock.sendMessage(jid, { text: welcomeMessage })
    
    // Si está configurado para pedir email inmediatamente
    if (welcomeFlowConfig.behavior.requestEmailImmediately) {
        // Actualizar estado a WAITING_EMAIL
        await updateContactStatus(jid, ContactStatus.WAITING_EMAIL)
    }

    logger.info('✅ Welcome message sent to new contact', { jid, contactName })
}

/**
 * Maneja cuando ya se envió la bienvenida pero aún no se ha completado el flujo
 */
async function handleWelcomeSent(
    sock: WASocket,
    jid: string,
    contactName: string | null,
    messageText: string
) {
    // Si el mensaje parece ser un email, procesarlo
    if (messageText && validateEmail(messageText.trim())) {
        await handleEmailResponse(sock, jid, contactName, messageText)
    } else {
        // Recordar que necesitamos el email
        const emailRequestMessage = await generateMessage(
            'emailRequest',
            contactName,
            null,
            null,
            null
        )
        
        await sock.sendMessage(jid, { text: emailRequestMessage })
        await updateContactStatus(jid, ContactStatus.WAITING_EMAIL)
        
        logger.info('📧 Email requested from contact', { jid, contactName })
    }
}

/**
 * Maneja la respuesta cuando estamos esperando el email
 */
async function handleEmailResponse(
    sock: WASocket,
    jid: string,
    contactName: string | null,
    messageText: string
) {
    const emailCandidate = messageText.trim()

    if (validateEmail(emailCandidate)) {
        // Email válido - confirmar y buscar LinkedIn
        const confirmationMessage = await generateMessage(
            'emailConfirmation',
            contactName,
            null,
            emailCandidate,
            null
        )
        
        await sock.sendMessage(jid, { text: confirmationMessage })
        
        // Actualizar contacto con email y cambiar estado
        await saveContact({
            jid,
            name: contactName,
            number: jid.split('@')[0],
            email: emailCandidate,
            status: ContactStatus.EMAIL_RECEIVED,
            lastMessageAt: admin.firestore.Timestamp.now()
        })
        
        logger.info('✅ Email collected, searching LinkedIn', { 
            jid, 
            contactName, 
            email: emailCandidate 
        })

        // Buscar perfil de LinkedIn en background
        searchAndHandleLinkedIn(sock, jid, contactName, emailCandidate)
        
    } else {
        // Email inválido - pedir nuevamente
        const errorMessage = await generateMessage(
            'emailError',
            contactName,
            null,
            emailCandidate,
            null
        )
        
        await sock.sendMessage(jid, { text: errorMessage })
        
        logger.info('❌ Invalid email format provided', { 
            jid, 
            contactName, 
            invalidEmail: emailCandidate 
        })
    }
}

/**
 * Busca el perfil de LinkedIn y maneja el resultado
 */
async function searchAndHandleLinkedIn(
    sock: WASocket,
    jid: string,
    contactName: string | null,
    email: string
) {
    try {
        // Buscar perfil de LinkedIn
        const linkedinProfile = await searchLinkedInProfile(email, contactName)
        
        if (linkedinProfile) {
            // LinkedIn encontrado - compartir info y pedir permiso para llamar
            const linkedinMessage = await generateMessage(
                'linkedinFound',
                contactName,
                null,
                email,
                linkedinProfile
            )
            
            await sock.sendMessage(jid, { text: linkedinMessage })
            
            // Actualizar contacto con datos de LinkedIn
            await saveContact({
                jid,
                name: contactName,
                number: jid.split('@')[0],
                email,
                linkedinProfile: linkedinProfile.profileUrl,
                linkedinData: linkedinProfile,
                status: ContactStatus.WAITING_CALL_PERMISSION,
                lastMessageAt: admin.firestore.Timestamp.now()
            })
            
            logger.info('🔗 LinkedIn profile found and shared', { 
                jid, 
                contactName,
                linkedinUrl: linkedinProfile.profileUrl 
            })
            
        } else {
            // LinkedIn no encontrado
            const notFoundMessage = await generateMessage(
                'linkedinNotFound',
                contactName,
                null,
                email,
                null
            )
            
            await sock.sendMessage(jid, { text: notFoundMessage })
            
            // Marcar como completado (no se puede enriquecer más)
            await updateContactStatus(jid, ContactStatus.COMPLETED)
            
            logger.info('📭 LinkedIn profile not found, flow completed', { jid, contactName })
        }
        
    } catch (error) {
        logger.error('Error searching LinkedIn profile', error, { jid, email })
        
        // En caso de error, marcar como completado
        await updateContactStatus(jid, ContactStatus.COMPLETED)
    }
}

/**
 * Maneja la respuesta sobre el permiso para llamar
 */
async function handleCallPermissionResponse(
    sock: WASocket,
    jid: string,
    contactName: string | null,
    messageText: string
) {
    const response = messageText.toLowerCase().trim()
    
    // Detectar respuesta positiva
    const positiveResponses = ['yes', 'yeah', 'sure', 'ok', 'okay', 'call me', 'go ahead', 'sounds good', 'let\'s do it']
    const negativeResponses = ['no', 'nope', 'not now', 'maybe later', 'pass', 'no thanks']
    
    const isPositive = positiveResponses.some(phrase => response.includes(phrase))
    const isNegative = negativeResponses.some(phrase => response.includes(phrase))
    
    if (isPositive) {
        // Usuario acepta la llamada
        const schedulingMessage = await generateMessage(
            'callScheduling',
            contactName,
            null,
            null,
            null
        )
        
        await sock.sendMessage(jid, { text: schedulingMessage })
        
        // Actualizar estado y programar llamada
        await saveContact({
            jid,
            name: contactName,
            number: jid.split('@')[0],
            callPermission: true,
            status: ContactStatus.CALL_SCHEDULED,
            lastMessageAt: admin.firestore.Timestamp.now()
        })
        
        // Programar la llamada
        const contact = await getContactByJid(jid)
        if (contact?.email) {
            const callResult = await scheduleCall(contactName, jid.split('@')[0], contact.email)
            
            if (callResult.success) {
                logger.info('📞 Call scheduled successfully', { 
                    jid, 
                    contactName,
                    callId: callResult.callId 
                })
            } else {
                logger.warn('⚠️ Call scheduling failed', { 
                    jid, 
                    contactName,
                    error: callResult.error 
                })
            }
        }
        
        // Marcar flujo como completado
        await updateContactStatus(jid, ContactStatus.COMPLETED)
        
    } else if (isNegative) {
        // Usuario rechaza la llamada
        const declinedMessage = await generateMessage(
            'callDeclined',
            contactName,
            null,
            null,
            null
        )
        
        await sock.sendMessage(jid, { text: declinedMessage })
        
        // Actualizar estado y marcar como completado
        await saveContact({
            jid,
            name: contactName,
            number: jid.split('@')[0],
            callPermission: false,
            status: ContactStatus.COMPLETED,
            lastMessageAt: admin.firestore.Timestamp.now()
        })
        
        logger.info('📵 Call permission declined', { jid, contactName })
        
    } else {
        // Respuesta ambigua - pedir clarificación
        await sock.sendMessage(jid, { 
            text: "Just to clarify - would you like me to call you to learn more about your background? A simple yes or no works!" 
        })
        
        logger.info('❓ Ambiguous call permission response', { jid, contactName, response })
    }
}

/**
 * Genera un mensaje usando IA o fallback a mensajes estáticos
 */
async function generateMessage(
    type: 'welcome' | 'emailRequest' | 'emailConfirmation' | 'emailError' | 'linkedinFound' | 'linkedinNotFound' | 'callScheduling' | 'callDeclined',
    contactName: string | null,
    contactNumber: string | null,
    email: string | null,
    linkedinProfile: any
): Promise<string> {
    
    // Si la IA está deshabilitada, usar mensajes estáticos
    if (!welcomeFlowConfig.ai.enabled) {
        return getStaticMessage(type)
    }

    try {
        let aiMessage: string

        switch (type) {
            case 'welcome':
                aiMessage = await generateWelcomeMessage(contactName, contactNumber)
                break
            case 'emailRequest':
                aiMessage = await generateEmailRequest(contactName)
                break
            case 'emailConfirmation':
                aiMessage = await generateEmailConfirmation(contactName, email!)
                break
            case 'emailError':
                aiMessage = await generateEmailErrorMessage(contactName, email!)
                break
            case 'linkedinFound':
                aiMessage = await generateLinkedInFoundMessage(contactName, linkedinProfile)
                break
            case 'linkedinNotFound':
                aiMessage = await generateLinkedInNotFoundMessage(contactName)
                break
            case 'callScheduling':
                aiMessage = await generateCallSchedulingMessage(contactName, termsAndConditionsLink)
                break
            case 'callDeclined':
                aiMessage = await generateCallDeclinedMessage(contactName)
                break
            default:
                throw new Error(`Unknown message type: ${type}`)
        }

        if (aiMessage && aiMessage.trim()) {
            logger.info(`✨ AI-generated ${type} message`, { contactName, length: aiMessage.length })
            return aiMessage
        } else {
            throw new Error('AI returned empty message')
        }
    } catch (error) {
        logger.warn(`AI message generation failed for ${type}, using fallback`, error)
        
        // Si está habilitado el fallback, usar mensajes estáticos
        if (welcomeFlowConfig.ai.fallbackToStatic) {
            return getStaticMessage(type)
        } else {
            throw error
        }
    }
}

/**
 * Obtiene mensaje estático según el tipo
 */
function getStaticMessage(type: string): string {
    switch (type) {
        case 'welcome':
            return welcomeFlowConfig.messages.greeting
        case 'emailRequest':
            return welcomeFlowConfig.messages.emailRequest
        case 'emailConfirmation':
            return "Perfect! Got your email. Let me look you up on LinkedIn..."
        case 'emailError':
            return welcomeFlowConfig.messages.emailInvalid
        case 'linkedinFound':
            return "Found your LinkedIn profile! You look interesting. Can I call you to learn more about your background?"
        case 'linkedinNotFound':
            return "Couldn't find your LinkedIn profile, but no worries! Can I call you to learn more about you?"
        case 'callScheduling':
            return "Awesome! Setting up the call now. I'll reach out within the next 30 minutes."
        case 'callDeclined':
            return "No problem at all! Feel free to reach out anytime you need help or have questions."
        default:
            return 'Error: Message not found'
    }
}

/**
 * Actualiza el estado de un contacto
 */
async function updateContactStatus(jid: string, status: ContactStatus) {
    try {
        const contact = await getContactByJid(jid)
        if (contact) {
            await saveContact({
                ...contact,
                status,
                lastMessageAt: admin.firestore.Timestamp.now()
            })
        }
    } catch (error) {
        logger.error('Error updating contact status', error, { jid, status })
    }
}

/**
 * Verifica si un contacto ha completado el flujo de bienvenida
 */
export async function hasCompletedWelcomeFlow(jid: string): Promise<boolean> {
    try {
        const contact = await getContactByJid(jid)
        return contact?.status === ContactStatus.COMPLETED
    } catch (error) {
        logger.error('Error checking welcome flow status', error, { jid })
        return false
    }
} 