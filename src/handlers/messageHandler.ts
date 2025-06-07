import { BaileysEventMap, WASocket, WAMessage } from 'baileys'
import admin from 'firebase-admin'

import { config } from '../config/index.js'
import { generateResponse } from '../ai/openai.js'
import { createLogger } from '../logger/index.js'
import { saveMessage, saveContact } from '../database/firestore.js'
import { ContactInfo } from '../interfaces.js'
import { processWelcomeFlow } from './welcomeFlow.js'

const logger = createLogger('MessageHandler')

export function setupMessageHandler(sock: WASocket) {
    // Handle incoming messages
    sock.ev.on(
        'messages.upsert',
        async ({ messages, type }: BaileysEventMap['messages.upsert']) => {
            // Only process new messages
            if (type !== 'notify') return

            for (const message of messages) {
                // Skip if no message content
                if (!message.message) continue

                // Skip messages from self
                if (message.key.fromMe) continue

                await handleMessage(sock, message)
            }
        }
    )
}

async function handleMessage(sock: WASocket, message: WAMessage) {
    try {
        const remoteJid = message.key.remoteJid
        if (!remoteJid) return

        // Get the text content from the message
        const textContent =
            message.message?.conversation || message.message?.extendedTextMessage?.text || ''

        if (!textContent) return

        // 📋 INFORMACIÓN COMPLETA DEL MENSAJE
        // Extraer información del contacto
        const contactInfo = await extractContactInfo(sock, message)
        
        // Mostrar toda la información disponible
        logger.info('📱 MENSAJE COMPLETO RECIBIDO:', {
            // Información básica del mensaje
            messageId: message.key.id,
            fromJid: remoteJid,
            timestamp: message.messageTimestamp,
            text: textContent,
            
            // Información del contacto
            contactName: contactInfo.name,
            contactNumber: contactInfo.number,

            
            // Información técnica
            messageType: getMessageType(message),
            fromMe: message.key.fromMe,
            participant: message.key.participant,
            
            // Información adicional si está disponible
            pushName: message.pushName,
            verifiedBizName: message.verifiedBizName,
            messageStubType: message.messageStubType,
        })
        
        if (contactInfo.isGroup) {
            return;
        }

        // 🎯 PROCESAR FLUJO DE BIENVENIDA PARA CONTACTOS NUEVOS
        const welcomeFlowProcessed = await processWelcomeFlow(
            sock,
            remoteJid,
            contactInfo.name,
            textContent
        )

        // Si el flujo de bienvenida procesó el mensaje, no continuar con otros procesamientos
        if (welcomeFlowProcessed) {
            logger.info('✅ Message processed by welcome flow', {
                from: remoteJid,
                contactName: contactInfo.name
            })
            
            // Aún así, guardar el mensaje en Firestore para registro
            const messageTimestamp = message.messageTimestamp 
                ? admin.firestore.Timestamp.fromMillis(Number(message.messageTimestamp) * 1000)
                : admin.firestore.Timestamp.now()

            await saveMessage({
                messageId: message.key.id || '',
                fromJid: remoteJid,
                contactName: contactInfo.name,
                contactNumber: contactInfo.number,
                text: textContent,
                timestamp: messageTimestamp,
                messageType: getMessageType(message),
                fromMe: message.key.fromMe || false,
                pushName: message.pushName || undefined
            })

            return
        }
                

        // 💾 GUARDAR EN FIRESTORE
        const messageTimestamp = message.messageTimestamp 
            ? admin.firestore.Timestamp.fromMillis(Number(message.messageTimestamp) * 1000)
            : admin.firestore.Timestamp.now()

        // Guardar el mensaje en Firestore
        await saveMessage({
            messageId: message.key.id || '',
            fromJid: remoteJid,
            contactName: contactInfo.name,
            contactNumber: contactInfo.number,
            text: textContent,
            timestamp: messageTimestamp,
            messageType: getMessageType(message),
            fromMe: message.key.fromMe || false,
            pushName: message.pushName || undefined
        })

        // Guardar/actualizar información del contacto
        await saveContact({
            jid: remoteJid,
            name: contactInfo.name,
            number: contactInfo.number,
            lastMessageAt: messageTimestamp
        })

        // If AI is enabled, use AI for all messages
        if (config.bot.aiEnabled) {
            logger.info('Processing AI request', { 
                prompt: textContent, 
                from: remoteJid,
                contactName: contactInfo.name 
            })

            try {
                // Incluir el nombre del contacto en el prompt si está disponible
                const promptWithName = contactInfo.name 
                    ? `Mensaje de ${contactInfo.name}: ${textContent}`
                    : textContent

                const aiReply = await generateResponse(promptWithName)
                await sock.sendMessage(remoteJid, { text: aiReply })
                logger.info('AI response sent', { 
                    to: remoteJid, 
                    contactName: contactInfo.name,
                    responseLength: aiReply.length 
                })
            } catch (error) {
                logger.error('AI request failed', error)
                await sock.sendMessage(remoteJid, {
                    text: 'Sorry, AI is currently unavailable. Please try again later.'
                })
            }
            return
        }

        // Solo registrar el mensaje sin responder (no echo)
        logger.info('✅ Mensaje procesado correctamente - Sin respuesta automática', {
            from: remoteJid,
            contactName: contactInfo.name,
            messageLength: textContent.length
        })

        // ❌ ECHO DESHABILITADO - El bot no responderá automáticamente
        // Si quieres reactivar el echo, descomenta las siguientes líneas:
        /*
        const echoMessage = contactInfo.name 
            ? `Hola ${contactInfo.name}! Echo: ${textContent}`
            : `Echo: ${textContent}`

        await sock.sendMessage(remoteJid, {
            text: echoMessage
        })

        logger.info('Echo response sent', {
            to: remoteJid,
            contactName: contactInfo.name,
            originalText: textContent
        })
        */
    } catch (error) {
        logger.error('Error handling message', error, {
            messageId: message.key.id,
            from: message.key.remoteJid
        })
    }
}

// 🔍 FUNCIÓN PARA EXTRAER INFORMACIÓN DEL CONTACTO
async function extractContactInfo(sock: WASocket, message: WAMessage): Promise<ContactInfo> {
    const remoteJid = message.key.remoteJid!
    const isGroup = remoteJid.endsWith('@g.us')
    
    let contactName: string | null = null
    let groupName: string | null = null
    let contactNumber: string | null = null

    try {
        if (isGroup) {
            // Si es un grupo, obtener información del grupo
            const groupMetadata = await sock.groupMetadata(remoteJid)
            groupName = groupMetadata.subject
            
            // Obtener nombre del participante que envió el mensaje
            const participantJid = message.key.participant
            if (participantJid) {
                contactNumber = participantJid.split('@')[0]
                // Intentar obtener el nombre del contacto
                try {
                    const contactInfo = await sock.onWhatsApp(participantJid)
                    contactName = message.pushName || (contactInfo && contactInfo[0] ? String(contactInfo[0].exists) : null)
                } catch {
                    contactName = message.pushName || null
                }
            }
        } else {
            // Si es un chat privado
            contactNumber = remoteJid.split('@')[0]
            contactName = message.pushName || null
            
            // Intentar obtener más información del contacto
            try {
                const contactInfo = await sock.onWhatsApp(remoteJid)
                // Solo usar pushName ya que la API de onWhatsApp no devuelve nombres
                contactName = message.pushName || null
            } catch (error) {
                // Si falla, usar el pushName
                contactName = message.pushName || null
            }
        }
    } catch (error) {
        logger.warn('Error extracting contact info', { error: (error as Error).message })
    }

    return {
        name: contactName,
        number: contactNumber,
        jid: remoteJid,
        isGroup,
        groupName
    }
}

// 🔍 FUNCIÓN PARA IDENTIFICAR EL TIPO DE MENSAJE
function getMessageType(message: WAMessage): string {
    if (message.message?.conversation) return 'text'
    if (message.message?.extendedTextMessage) return 'extendedText'
    if (message.message?.imageMessage) return 'image'
    if (message.message?.videoMessage) return 'video'
    if (message.message?.audioMessage) return 'audio'
    if (message.message?.documentMessage) return 'document'
    if (message.message?.stickerMessage) return 'sticker'
    if (message.message?.locationMessage) return 'location'
    if (message.message?.contactMessage) return 'contact'
    if (message.message?.listResponseMessage) return 'listResponse'
    if (message.message?.buttonsResponseMessage) return 'buttonsResponse'
    
    return 'unknown'
}
