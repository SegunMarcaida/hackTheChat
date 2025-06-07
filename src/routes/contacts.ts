import { Router, Request, Response } from 'express'
import { getContacts, getContactByJid, getMessagesByContact } from '../database/firestore.js'
import { Contact } from '../interfaces.js'
import { createLogger } from '../logger/index.js'

const router = Router()
const logger = createLogger('ContactsAPI')

// GET /api/contacts - Obtener todos los contactos con paginación
router.get('/api/contacts', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50
        const startAfter = req.query.startAfter as string
        
        // Validar límite
        if (limit > 100) {
            return res.status(400).json({
                success: false,
                error: 'Limit cannot exceed 100 contacts per request'
            })
        }

        const contacts = await getContacts(limit, startAfter)
        
        logger.info(`📇 API: Retrieved ${contacts.length} contacts`, { 
            limit, 
            startAfter: startAfter || 'none' 
        })

        res.json({
            success: true,
            data: {
                contacts,
                count: contacts.length,
                hasMore: contacts.length === limit
            }
        })
    } catch (error) {
        logger.error('❌ Error fetching contacts', error)
        res.status(500).json({
            success: false,
            error: 'Failed to fetch contacts'
        })
    }
})

// GET /api/contacts/:jid - Obtener un contacto específico por JID
router.get('/api/contacts/:jid', async (req: Request, res: Response) => {
    try {
        const { jid } = req.params
        
        if (!jid) {
            return res.status(400).json({
                success: false,
                error: 'JID parameter is required'
            })
        }

        const contact = await getContactByJid(jid)
        
        if (!contact) {
            return res.status(404).json({
                success: false,
                error: 'Contact not found'
            })
        }

        logger.info('👤 API: Contact retrieved', { 
            jid, 
            name: contact.name 
        })

        res.json({
            success: true,
            data: contact
        })
    } catch (error) {
        logger.error('❌ Error fetching contact', error)
        res.status(500).json({
            success: false,
            error: 'Failed to fetch contact'
        })
    }
})

// GET /api/contacts/:jid/messages - Obtener mensajes de un contacto específico
router.get('/api/contacts/:jid/messages', async (req: Request, res: Response) => {
    try {
        const { jid } = req.params
        const limit = parseInt(req.query.limit as string) || 10
        
        if (!jid) {
            return res.status(400).json({
                success: false,
                error: 'JID parameter is required'
            })
        }

        // Validar límite
        if (limit > 50) {
            return res.status(400).json({
                success: false,
                error: 'Limit cannot exceed 50 messages per request'
            })
        }

        const messages = await getMessagesByContact(jid, limit)
        
        logger.info(`📥 API: Retrieved ${messages.length} messages for contact`, { 
            jid, 
            limit 
        })

        res.json({
            success: true,
            data: {
                messages,
                count: messages.length,
                contactJid: jid
            }
        })
    } catch (error) {
        logger.error('❌ Error fetching contact messages', error)
        res.status(500).json({
            success: false,
            error: 'Failed to fetch contact messages'
        })
    }
})

export default router 