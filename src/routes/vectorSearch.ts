import { Router, Request, Response } from 'express'
import { 
    vectorizeContact, 
    vectorizeAllContacts, 
    findSimilarContacts,
    findSimilarContactsWithVectorSearch,
    getVectorizationStats,
    getVectorizedContact,
    deleteVectorizedContact,
    revectorizeContact
} from '../database/vectorDatabase.js'
import { getContactByJid } from '../database/firestore.js'
import { ContactSearchParams } from '../interfaces.js'
import { createLogger } from '../logger/index.js'

const router = Router()
const logger = createLogger('VectorSearchAPI')

// POST /api/vectors/vectorize/:jid - Vectorizar un contacto específico
router.post('/api/vectors/vectorize/:jid', async (req: Request, res: Response) => {
    try {
        const { jid } = req.params
        
        if (!jid) {
            return res.status(400).json({
                success: false,
                error: 'JID parameter is required'
            })
        }

        // Obtener el contacto original
        const contact = await getContactByJid(jid)
        if (!contact) {
            return res.status(404).json({
                success: false,
                error: 'Contact not found'
            })
        }

        // Vectorizar el contacto
        const success = await vectorizeContact(contact)
        
        if (success) {
            const vectorizedContact = await getVectorizedContact(jid)
            
            logger.info('✅ Contact vectorized via API', { jid, name: contact.name })
            res.json({
                success: true,
                message: 'Contact vectorized successfully',
                data: {
                    jid,
                    name: contact.name,
                    vectorDimension: vectorizedContact?.embeddingVector.length,
                    embeddingText: vectorizedContact?.embeddingText
                }
            })
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to vectorize contact'
            })
        }

    } catch (error) {
        logger.error('❌ Error vectorizing contact', error)
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        })
    }
})

// POST /api/vectors/vectorize-all - Vectorizar todos los contactos
router.post('/api/vectors/vectorize-all', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.body.limit as string) || 10
        
        if (limit > 50) {
            return res.status(400).json({
                success: false,
                error: 'Limit cannot exceed 50 contacts per batch'
            })
        }

        const vectorizedCount = await vectorizeAllContacts(limit)
        
        logger.info('✅ Batch vectorization completed via API', { 
            limit, 
            vectorizedCount 
        })
        
        res.json({
            success: true,
            message: `Vectorized ${vectorizedCount} contacts`,
            data: {
                processed: vectorizedCount,
                limit
            }
        })

    } catch (error) {
        logger.error('❌ Error in batch vectorization', error)
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        })
    }
})

// GET /api/vectors/stats - Obtener estadísticas de vectorización
router.get('/api/vectors/stats', async (req: Request, res: Response) => {
    try {
        const stats = await getVectorizationStats()
        
        res.json({
            success: true,
            data: stats
        })

    } catch (error) {
        logger.error('❌ Error getting vectorization stats', error)
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        })
    }
})

// GET /api/vectors/:jid - Obtener contacto vectorizado por JID
router.get('/api/vectors/:jid', async (req: Request, res: Response) => {
    try {
        const { jid } = req.params
        
        if (!jid) {
            return res.status(400).json({
                success: false,
                error: 'JID parameter is required'
            })
        }

        const vectorizedContact = await getVectorizedContact(jid)
        
        if (!vectorizedContact) {
            return res.status(404).json({
                success: false,
                error: 'Vectorized contact not found'
            })
        }

        res.json({
            success: true,
            data: vectorizedContact
        })

    } catch (error) {
        logger.error('❌ Error getting vectorized contact', error)
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        })
    }
})

// DELETE /api/vectors/:jid - Eliminar contacto vectorizado
router.delete('/api/vectors/:jid', async (req: Request, res: Response) => {
    try {
        const { jid } = req.params
        
        if (!jid) {
            return res.status(400).json({
                success: false,
                error: 'JID parameter is required'
            })
        }

        const success = await deleteVectorizedContact(jid)
        
        if (success) {
            res.json({
                success: true,
                message: 'Vectorized contact deleted successfully'
            })
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to delete vectorized contact'
            })
        }

    } catch (error) {
        logger.error('❌ Error deleting vectorized contact', error)
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        })
    }
})

// POST /api/vectors/search - Buscar contactos similares
router.post('/api/vectors/search', async (req: Request, res: Response) => {
    try {
        const {
            query,
            queryVector,
            limit = 10,
            minSimilarity = 0.3,
            excludeJids = [],
            useVectorSearch = false
        } = req.body

        // Validaciones
        if (!query && !queryVector) {
            return res.status(400).json({
                success: false,
                error: 'Either query text or queryVector is required'
            })
        }

        if (limit > 50) {
            return res.status(400).json({
                success: false,
                error: 'Limit cannot exceed 50 results'
            })
        }

        if (minSimilarity < 0 || minSimilarity > 1) {
            return res.status(400).json({
                success: false,
                error: 'minSimilarity must be between 0 and 1'
            })
        }

        const searchParams: ContactSearchParams = {
            query,
            queryVector,
            limit,
            minSimilarity,
            excludeJids
        }

        // Elegir método de búsqueda
        const results = useVectorSearch 
            ? await findSimilarContactsWithVectorSearch(searchParams)
            : await findSimilarContacts(searchParams)

        logger.info('🔍 Similar contacts search completed via API', {
            query: query || 'vector query',
            resultsCount: results.length,
            method: useVectorSearch ? 'vector-search' : 'manual'
        })

        res.json({
            success: true,
            data: {
                results,
                count: results.length,
                searchParams: {
                    query,
                    limit,
                    minSimilarity,
                    method: useVectorSearch ? 'vector-search' : 'manual'
                }
            }
        })

    } catch (error) {
        logger.error('❌ Error searching similar contacts', error)
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        })
    }
})

// GET /api/vectors/similar/:jid - Buscar contactos similares a un contacto específico
router.get('/api/vectors/similar/:jid', async (req: Request, res: Response) => {
    try {
        const { jid } = req.params
        const limit = parseInt(req.query.limit as string) || 10
        const minSimilarity = parseFloat(req.query.minSimilarity as string) || 0.3
        const useVectorSearch = req.query.useVectorSearch === 'true'

        if (!jid) {
            return res.status(400).json({
                success: false,
                error: 'JID parameter is required'
            })
        }

        // Obtener el contacto vectorizado
        const vectorizedContact = await getVectorizedContact(jid)
        if (!vectorizedContact) {
            return res.status(404).json({
                success: false,
                error: 'Vectorized contact not found. Please vectorize it first.',
                data: {
                    jid,
                    needsVectorization: true
                }
            })
        }

        const searchParams: ContactSearchParams = {
            queryVector: vectorizedContact.embeddingVector,
            limit,
            minSimilarity,
            excludeJids: [jid] // Excluir el contacto mismo
        }

        // Buscar contactos similares
        const results = useVectorSearch 
            ? await findSimilarContactsWithVectorSearch(searchParams)
            : await findSimilarContacts(searchParams)

        logger.info('🔍 Similar contacts found for specific contact via API', {
            targetJid: jid,
            targetName: vectorizedContact.name,
            resultsCount: results.length
        })

        res.json({
            success: true,
            data: {
                targetContact: {
                    jid: vectorizedContact.jid,
                    name: vectorizedContact.name,
                    embeddingText: vectorizedContact.embeddingText
                },
                similarContacts: results,
                count: results.length,
                searchParams: {
                    limit,
                    minSimilarity,
                    method: useVectorSearch ? 'vector-search' : 'manual'
                }
            }
        })

    } catch (error) {
        logger.error('❌ Error finding similar contacts for specific contact', error)
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        })
    }
})

// POST /api/vectors/revectorize/:jid - Re-vectorizar un contacto
router.post('/api/vectors/revectorize/:jid', async (req: Request, res: Response) => {
    try {
        const { jid } = req.params
        
        if (!jid) {
            return res.status(400).json({
                success: false,
                error: 'JID parameter is required'
            })
        }

        // Obtener el contacto original
        const contact = await getContactByJid(jid)
        if (!contact) {
            return res.status(404).json({
                success: false,
                error: 'Contact not found'
            })
        }

        // Re-vectorizar el contacto
        const success = await revectorizeContact(contact)
        
        if (success) {
            const vectorizedContact = await getVectorizedContact(jid)
            
            logger.info('✅ Contact re-vectorized via API', { jid, name: contact.name })
            res.json({
                success: true,
                message: 'Contact re-vectorized successfully',
                data: {
                    jid,
                    name: contact.name,
                    vectorDimension: vectorizedContact?.embeddingVector.length,
                    embeddingText: vectorizedContact?.embeddingText,
                    updatedAt: vectorizedContact?.updatedAt
                }
            })
        } else {
            res.json({
                success: true,
                message: 'Contact was already up to date, no re-vectorization needed',
                data: {
                    jid,
                    name: contact.name
                }
            })
        }

    } catch (error) {
        logger.error('❌ Error re-vectorizing contact', error)
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        })
    }
})

export default router 