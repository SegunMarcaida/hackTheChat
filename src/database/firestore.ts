import admin from 'firebase-admin'
import { config } from '../config/index.js'
import { createLogger } from '../logger/index.js'
import { Contact, CreateContactData } from '../interfaces.js'

const logger = createLogger('Firestore')

// Inicializar Firebase Admin
let db: admin.firestore.Firestore | null = null

export function initializeFirestore() {
    try {
        // Verificar que tenemos las credenciales necesarias
        if (!config.firebase.projectId || !config.firebase.privateKey || !config.firebase.clientEmail) {
            logger.warn('Firebase credentials not configured. Firestore will be disabled.')
            return null
        }

        // Inicializar Firebase Admin solo si no está ya inicializado
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: config.firebase.projectId,
                    privateKey: config.firebase.privateKey,
                    clientEmail: config.firebase.clientEmail,
                }),
                databaseURL: config.firebase.databaseURL
            })
            logger.info('✅ Firebase Admin initialized successfully')
        }

        db = admin.firestore()
        logger.info('✅ Firestore connection established')
        return db
    } catch (error) {
        logger.error('❌ Failed to initialize Firestore', error)
        return null
    }
}

// Interfaz para el mensaje en Firestore
export interface FirestoreMessage {
    messageId: string
    fromJid: string
    contactName: string | null
    contactNumber: string | null
    text: string
    timestamp: admin.firestore.Timestamp
    messageType: string
    fromMe: boolean
    pushName: string | undefined
    processed: boolean
    createdAt: admin.firestore.Timestamp
}

// Función para guardar un mensaje en Firestore
export async function saveMessage(messageData: Omit<FirestoreMessage, 'createdAt' | 'processed'>): Promise<boolean> {
    try {
        if (!db) {
            logger.warn('Firestore not initialized. Message not saved.')
            return false
        }

        const docData: FirestoreMessage = {
            ...messageData,
            processed: true,
            createdAt: admin.firestore.Timestamp.now()
        }

        // Guardar en la colección 'messages'
        await db.collection('messages').add(docData)
        
        logger.info('💾 Message saved to Firestore', {
            messageId: messageData.messageId,
            from: messageData.contactName || messageData.contactNumber,
            collection: 'messages'
        })
        
        return true
    } catch (error) {
        logger.error('❌ Failed to save message to Firestore', error, {
            messageId: messageData.messageId
        })
        return false
    }
}

// Función para obtener mensajes de un contacto
export async function getMessagesByContact(contactJid: string, limit: number = 10) {
    try {
        if (!db) {
            logger.warn('Firestore not initialized')
            return []
        }

        const snapshot = await db.collection('messages')
            .where('fromJid', '==', contactJid)
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get()

        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }))

        logger.info(`📥 Retrieved ${messages.length} messages for contact`, {
            contactJid,
            messageCount: messages.length
        })

        return messages
    } catch (error) {
        logger.error('❌ Failed to get messages from Firestore', error)
        return []
    }
}

// Función para guardar información de contacto
export async function saveContact(contactData: CreateContactData): Promise<boolean> {
    try {
        if (!db) return false

        const contactDocument: Contact = {
            ...contactData,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
        }

        // Usar el JID como ID del documento para evitar duplicados
        await db.collection('contacts').doc(contactData.jid).set(contactDocument, { merge: true })
        
        logger.info('👤 Contact saved/updated in Firestore', {
            jid: contactData.jid,
            name: contactData.name,
        })
        
        return true
    } catch (error) {
        logger.error('❌ Failed to save contact to Firestore', error)
        return false
    }
}

// Función para obtener un contacto por JID
export async function getContactByJid(jid: string): Promise<Contact | null> {
    try {
        if (!db) {
            logger.warn('Firestore not initialized')
            return null
        }

        const doc = await db.collection('contacts').doc(jid).get()
        
        if (!doc.exists) {
            logger.info(`📭 Contact not found`, { jid })
            return null
        }

        const contactData = doc.data() as Contact
        logger.info(`👤 Contact retrieved`, { jid, name: contactData.name })
        
        return contactData
    } catch (error) {
        logger.error('❌ Failed to get contact from Firestore', error)
        return null
    }
}

// Función para obtener todos los contactos con paginación
export async function getContacts(limit: number = 50, startAfter?: string): Promise<Contact[]> {
    try {
        if (!db) {
            logger.warn('Firestore not initialized')
            return []
        }

        let query = db.collection('contacts')
            .orderBy('lastMessageAt', 'desc')
            .limit(limit)

        if (startAfter) {
            const startAfterDoc = await db.collection('contacts').doc(startAfter).get()
            if (startAfterDoc.exists) {
                query = query.startAfter(startAfterDoc)
            }
        }

        const snapshot = await query.get()
        const contacts = snapshot.docs.map(doc => doc.data() as Contact)

        logger.info(`📇 Retrieved ${contacts.length} contacts`)
        return contacts
    } catch (error) {
        logger.error('❌ Failed to get contacts from Firestore', error)
        return []
    }
}

// Función para obtener estadísticas
export async function getMessageStats() {
    try {
        if (!db) return null

        // Contar total de mensajes
        const messagesSnapshot = await db.collection('messages').count().get()
        const totalMessages = messagesSnapshot.data().count

        // Contar total de contactos
        const contactsSnapshot = await db.collection('contacts').count().get()
        const totalContacts = contactsSnapshot.data().count

        const stats = {
            totalMessages,
            totalContacts,
            lastUpdated: admin.firestore.Timestamp.now()
        }

        logger.info('📊 Firestore stats retrieved', stats)
        return stats
    } catch (error) {
        logger.error('❌ Failed to get stats from Firestore', error)
        return null
    }
}

// Exportar la instancia de Firestore para uso directo si es necesario
export { db } 