import { WASocket } from 'baileys'
import { ContactStatus } from '../interfaces.js'
import { getContactByJid, saveContact } from '../database/firestore.js'
import { createLogger } from '../logger/index.js'
import { welcomeFlowConfig, validateEmail } from '../config/welcomeFlow.js'
import { 
    generateWelcomeMessage, 
    generateEmailRequest, 
    generateEmailConfirmation, 
    generateEmailErrorMessage,
    generateLinkedInFoundMessage,
    generateLinkedInNotFoundMessage,
    generateCallSchedulingMessage,
    generateCallDeclinedMessage,
    generateAuth0PublicityMessage
} from '../ai/openai.js'
import { searchLinkedInProfile } from '../services/linkedinService.js'
import { scheduleCall } from '../services/callingService.js'
import admin from 'firebase-admin'
import fs from 'fs'

const logger = createLogger('WelcomeFlow')

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
            case ContactStatus.CALL_FINISHED:
                // Flujo completado, no intervenir
                return false

            case ContactStatus.AUTH0_SENT:
                // Auth0 publicity sent, mark as completed
                await updateContactStatus(jid, ContactStatus.COMPLETED)
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
        // Obtener el contacto actualizado (con el email recién guardado)
        const existingContact = await getContactByJid(jid)

        if (!existingContact) {
            logger.warn('Contact not found when attempting LinkedIn search', { jid })
            return
        }

        // Buscar perfil de LinkedIn usando el servicio de enriquecimiento
        const searchResult = await searchLinkedInProfile(existingContact)

        if (searchResult?.found && searchResult.enrichedData) {
            // LinkedIn encontrado y enriquecido - compartir info y pedir permiso para llamar
            const linkedinMessage = await generateMessage(
                'linkedinFound',
                contactName,
                null,
                email,
                searchResult.enrichedData
            )
            
            await sock.sendMessage(jid, { text: linkedinMessage })
            
            // Actualizar contacto con datos de LinkedIn enriquecidos
            if (existingContact) {
                const enrichedData = searchResult.enrichedData
                await saveContact({
                    jid: existingContact.id,
                    name: enrichedData.firstName && enrichedData.lastName 
                        ? `${enrichedData.firstName} ${enrichedData.lastName}` 
                        : enrichedData.name || existingContact.name,
                    number: existingContact.number,
                    email,
                    linkedinProfile: searchResult.profileUrl,
                    status: ContactStatus.WAITING_CALL_PERMISSION,
                    lastMessageAt: admin.firestore.Timestamp.now()
                })
            }
            
            logger.info('🔗 LinkedIn profile found, enriched and shared', { 
                jid, 
                contactName,
                linkedinUrl: searchResult.profileUrl,
                company: searchResult.enrichedData.company,
                jobTitle: searchResult.enrichedData.jobTitle
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
            
            const errorMsg = searchResult?.error || 'Profile not found'
            logger.info('📭 LinkedIn profile not found, flow completed', { 
                jid, 
                contactName, 
                email,
                reason: errorMsg 
            })
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
    type: 'welcome' | 'emailRequest' | 'emailConfirmation' | 'emailError' | 'linkedinFound' | 'linkedinNotFound' | 'callScheduling' | 'callDeclined' | 'auth0Publicity',
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
                aiMessage = await generateCallSchedulingMessage(contactName)
                break
            case 'callDeclined':
                aiMessage = await generateCallDeclinedMessage(contactName)
                break
            case 'auth0Publicity':
                aiMessage = await generateAuth0PublicityMessage(contactName)
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
        case 'auth0Publicity':
            return "By the way, I wanted to share something that might interest you - Auth0 is a powerful identity platform that makes authentication and user management incredibly easy for developers. It's trusted by thousands of companies and could really streamline your development process. Check it out: https://auth0.com"
        default:
            return 'Error: Message not found'
    }
}


async function updateContactStatus(jid: string, status: ContactStatus) {
    try {
        const contact = await getContactByJid(jid)
        if (contact) {
            await saveContact({
                jid: contact.id, // Map Contact.id to CreateContactData.jid
                name: contact.name,
                number: contact.number,
                email: contact.email,
                linkedinProfile: contact.linkedinProfile,
                status,
                callPermission: contact.callPermission,
                callScheduled: contact.callScheduled,
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

/**
 * Maneja el envío de publicidad de Auth0 después de terminar la llamada
 */
export async function handleAuth0Publicity(
    sock: WASocket,
    jid: string,
    contactName: string | null
) {
    try {
        logger.info('🔰 Sending Auth0 publicity', { jid, contactName })

        // Generar mensaje personalizado de Auth0
        const auth0Message = await generateMessage(
            'auth0Publicity',
            contactName,
            null,
            null,
            null
        )

        // Enviar mensaje de texto primero
        await sock.sendMessage(jid, { text: auth0Message })

        // Enviar imagen de Auth0 (usando la imagen proporcionada por el usuario)
        try {
            await sock.sendMessage(jid, {
                image: {
                    url: './assets/image.png'
                },
                caption: 'Learn more at: https://auth0.com'
            })
        } catch (imageError) {
            logger.warn('Failed to send Auth0 image, trying with fs buffer', imageError)
            try {
                // Alternative approach: use fs to read file as buffer
                await sock.sendMessage(jid, {
                    image: fs.readFileSync('./assets/image.png'),
                    caption: 'Learn more at: https://auth0.com'
                })
            } catch (fsError) {
                logger.warn('Alternative image sending also failed, sending text with URL instead', fsError)
                await sock.sendMessage(jid, { 
                    text: 'Learn more about Auth0: https://auth0.com' 
                })
            }
        }

        // Actualizar estado del contacto a AUTH0_SENT
        await updateContactStatus(jid, ContactStatus.AUTH0_SENT)

        logger.info('✅ Auth0 publicity sent successfully', {
            jid,
            contactName,
            messageLength: auth0Message.length
        })

    } catch (error) {
        logger.error('Error sending Auth0 publicity', error, { jid, contactName })
        // En caso de error, marcar como completado
        await updateContactStatus(jid, ContactStatus.COMPLETED)
    }
} 