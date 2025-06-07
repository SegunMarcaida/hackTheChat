import admin from 'firebase-admin'
import { initializeFirestore } from './firestore.js'
import { 
    Contact, 
    VectorizedContact, 
    CreateVectorizedContactData, 
    SimilarContactResult, 
    ContactSearchParams 
} from '../interfaces.js'
import { createLogger } from '../logger/index.js'
import { 
    generateContactVector, 
    generateQueryVector, 
    calculateCosineSimilarity 
} from '../services/vectorization.js'

const logger = createLogger('VectorDatabase')

// Obtener la instancia de Firestore
const db = initializeFirestore()

const VECTORIZED_CONTACTS_COLLECTION = 'vectorized-contacts'

/**
 * Vectoriza un contacto y lo guarda en la colección vectorized-contacts
 * @param contact - Contacto a vectorizar
 * @returns true si la vectorización fue exitosa
 */
export async function vectorizeContact(contact: Contact): Promise<boolean> {
    try {
        if (!db) {
            logger.warn('Firestore not initialized')
            return false
        }

        // Generar vector del contacto
        const vectorResult = await generateContactVector(contact)
        
        if (!vectorResult.success) {
            logger.warn('Failed to generate vector for contact', {
                jid: contact.jid,
                error: vectorResult.error
            })
            return false
        }

        // Crear el documento vectorizado
        const vectorizedContactData: CreateVectorizedContactData = {
            jid: contact.jid,
            name: contact.name,
            number: contact.number,
            email: contact.email || null,
            linkedinProfile: contact.linkedinProfile || null,
            linkedinData: contact.linkedinData || null,
            embeddingVector: vectorResult.vector,
            embeddingText: vectorResult.textUsed,
            vectorizedAt: admin.firestore.Timestamp.now(),
            vectorVersion: 'text-embedding-3-small'
        }

        const vectorizedContact: VectorizedContact = {
            ...vectorizedContactData,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
        }

        // Guardar en la colección vectorized-contacts usando JID como ID
        await db.collection(VECTORIZED_CONTACTS_COLLECTION)
            .doc(contact.jid)
            .set(vectorizedContact, { merge: true })

        logger.info('✅ Contact vectorized and saved', {
            jid: contact.jid,
            name: contact.name,
            vectorDimension: vectorResult.vector.length,
            textUsed: vectorResult.textUsed
        })

        return true

    } catch (error) {
        logger.error('❌ Failed to vectorize contact', error, {
            jid: contact.jid,
            name: contact.name
        })
        return false
    }
}

/**
 * Obtiene un contacto vectorizado por JID
 * @param jid - JID del contacto
 * @returns Contacto vectorizado o null si no existe
 */
export async function getVectorizedContact(jid: string): Promise<VectorizedContact | null> {
    try {
        if (!db) {
            logger.warn('Firestore not initialized')
            return null
        }

        const doc = await db.collection(VECTORIZED_CONTACTS_COLLECTION).doc(jid).get()
        
        if (!doc.exists) {
            return null
        }

        return doc.data() as VectorizedContact

    } catch (error) {
        logger.error('❌ Failed to get vectorized contact', error, { jid })
        return null
    }
}

/**
 * Vectoriza todos los contactos que no han sido vectorizados
 * @param limit - Límite de contactos a procesar por lote
 * @returns Número de contactos vectorizados
 */
export async function vectorizeAllContacts(limit: number = 10): Promise<number> {
    try {
        if (!db) {
            logger.warn('Firestore not initialized')
            return 0
        }

        // Obtener contactos de la colección original
        const contactsSnapshot = await db.collection('contacts')
            .limit(limit * 2) // Obtener más para filtrar
            .get()

        if (contactsSnapshot.empty) {
            logger.info('No contacts found to vectorize')
            return 0
        }

        // Obtener JIDs ya vectorizados
        const vectorizedSnapshot = await db.collection(VECTORIZED_CONTACTS_COLLECTION)
            .select('jid')
            .get()
        
        const vectorizedJids = new Set(vectorizedSnapshot.docs.map(doc => doc.id))

        let vectorizedCount = 0
        let processed = 0

        // Procesar contactos en lotes para evitar sobrecargar la API
        for (const doc of contactsSnapshot.docs) {
            if (processed >= limit) break

            const contact = doc.data() as Contact
            
            // Saltar si ya está vectorizado
            if (vectorizedJids.has(contact.jid)) {
                continue
            }

            // Solo vectorizar contactos con información suficiente
            if (contact.linkedinData || contact.email) {
                const success = await vectorizeContact(contact)
                if (success) {
                    vectorizedCount++
                }
                
                // Pequeña pausa entre requests para evitar rate limiting
                await new Promise(resolve => setTimeout(resolve, 100))
            }

            processed++
        }

        logger.info(`✅ Vectorization batch completed`, {
            processed,
            successful: vectorizedCount
        })

        return vectorizedCount

    } catch (error) {
        logger.error('❌ Failed to vectorize contacts batch', error)
        return 0
    }
}

/**
 * Busca contactos similares usando similitud coseno calculada en memoria
 * @param params - Parámetros de búsqueda
 * @returns Lista de contactos similares ordenados por similitud
 */
export async function findSimilarContacts(params: ContactSearchParams): Promise<SimilarContactResult[]> {
    try {
        if (!db) {
            logger.warn('Firestore not initialized')
            return []
        }

        const {
            query,
            queryVector,
            limit = 10,
            minSimilarity = 0.3,
            excludeJids = []
        } = params

        let searchVector: number[] = []

        // Obtener vector de búsqueda
        if (queryVector) {
            searchVector = queryVector
        } else if (query) {
            const vectorResult = await generateQueryVector(query)
            if (!vectorResult.success) {
                logger.warn('Failed to generate query vector', { query, error: vectorResult.error })
                return []
            }
            searchVector = vectorResult.vector
        } else {
            logger.warn('No query or queryVector provided')
            return []
        }

        // Obtener todos los contactos vectorizados
        const snapshot = await db.collection(VECTORIZED_CONTACTS_COLLECTION).get()

        if (snapshot.empty) {
            logger.info('No vectorized contacts found')
            return []
        }

        const similarities: SimilarContactResult[] = []

        // Calcular similitudes
        for (const doc of snapshot.docs) {
            const contact = doc.data() as VectorizedContact
            
            // Excluir JIDs especificados
            if (excludeJids.includes(contact.jid)) {
                continue
            }

            try {
                const similarity = calculateCosineSimilarity(searchVector, contact.embeddingVector)
                
                if (similarity >= minSimilarity) {
                    similarities.push({
                        contact,
                        similarity,
                        distance: 1 - similarity // Convertir similitud a distancia
                    })
                }
            } catch (error) {
                logger.warn('Error calculating similarity', {
                    contactJid: contact.jid,
                    error: error instanceof Error ? error.message : 'Unknown error'
                })
            }
        }

        // Ordenar por similitud (mayor a menor) y limitar resultados
        const sortedResults = similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit)

        logger.info('✅ Similar contacts search completed', {
            query: query || 'vector query',
            totalContacts: snapshot.size,
            matchingContacts: similarities.length,
            returnedResults: sortedResults.length,
            minSimilarity
        })

        return sortedResults

    } catch (error) {
        logger.error('❌ Failed to find similar contacts', error, params)
        return []
    }
}

/**
 * Busca contactos similares usando Firestore Vector Search (requiere índices)
 * @param params - Parámetros de búsqueda
 * @returns Lista de contactos similares
 */
export async function findSimilarContactsWithVectorSearch(params: ContactSearchParams): Promise<SimilarContactResult[]> {
    try {
        if (!db) {
            logger.warn('Firestore not initialized')
            return []
        }

        const {
            query,
            queryVector,
            limit = 10,
            excludeJids = []
        } = params

        let searchVector: number[] = []

        // Obtener vector de búsqueda
        if (queryVector) {
            searchVector = queryVector
        } else if (query) {
            const vectorResult = await generateQueryVector(query)
            if (!vectorResult.success) {
                logger.warn('Failed to generate query vector', { query, error: vectorResult.error })
                return []
            }
            searchVector = vectorResult.vector
        } else {
            logger.warn('No query or queryVector provided')
            return []
        }

        // Usar Firestore Vector Search
        const vectorQuery = db.collection(VECTORIZED_CONTACTS_COLLECTION)
            .findNearest({
                vectorField: 'embeddingVector',
                queryVector: searchVector,
                limit: limit,
                distanceMeasure: 'COSINE'
            })

        const snapshot = await vectorQuery.get()
        const results: SimilarContactResult[] = []

        snapshot.forEach((doc) => {
            const contact = doc.data() as VectorizedContact
            
            // Excluir JIDs especificados
            if (!excludeJids.includes(contact.jid)) {
                // Calcular similitud manualmente ya que Firestore no la proporciona directamente
                const similarity = calculateCosineSimilarity(searchVector, contact.embeddingVector)

                results.push({
                    contact,
                    similarity,
                    distance: 1 - similarity
                })
            }
        })

        logger.info('✅ Vector search completed', {
            query: query || 'vector query',
            returnedResults: results.length
        })

        return results

    } catch (error) {
        logger.error('❌ Vector search failed, falling back to manual search', error)
        // Fallback a búsqueda manual
        return findSimilarContacts(params)
    }
}

/**
 * Obtiene estadísticas de vectorización
 * @returns Estadísticas de contactos vectorizados
 */
export async function getVectorizationStats(): Promise<{
    totalContacts: number
    vectorizedContacts: number
    percentage: number
}> {
    try {
        if (!db) {
            logger.warn('Firestore not initialized')
            return { totalContacts: 0, vectorizedContacts: 0, percentage: 0 }
        }

        // Contar total de contactos
        const totalSnapshot = await db.collection('contacts').count().get()
        const totalContacts = totalSnapshot.data().count

        // Contar contactos vectorizados
        const vectorizedSnapshot = await db.collection(VECTORIZED_CONTACTS_COLLECTION).count().get()
        const vectorizedContacts = vectorizedSnapshot.data().count

        const percentage = totalContacts > 0 ? (vectorizedContacts / totalContacts) * 100 : 0

        return {
            totalContacts,
            vectorizedContacts,
            percentage: Math.round(percentage * 100) / 100
        }

    } catch (error) {
        logger.error('❌ Failed to get vectorization stats', error)
        return { totalContacts: 0, vectorizedContacts: 0, percentage: 0 }
    }
}

/**
 * Elimina un contacto vectorizado
 * @param jid - JID del contacto a eliminar
 * @returns true si se eliminó exitosamente
 */
export async function deleteVectorizedContact(jid: string): Promise<boolean> {
    try {
        if (!db) {
            logger.warn('Firestore not initialized')
            return false
        }

        await db.collection(VECTORIZED_CONTACTS_COLLECTION).doc(jid).delete()
        
        logger.info('✅ Vectorized contact deleted', { jid })
        return true

    } catch (error) {
        logger.error('❌ Failed to delete vectorized contact', error, { jid })
        return false
    }
}

/**
 * Re-vectoriza un contacto existente si hay cambios en su información
 * @param contact - Contacto con información actualizada
 * @returns true si fue re-vectorizado
 */
export async function revectorizeContact(contact: Contact): Promise<boolean> {
    try {
        const existingVectorized = await getVectorizedContact(contact.jid)
        
        if (!existingVectorized) {
            // No existe, vectorizar por primera vez
            return await vectorizeContact(contact)
        }

        // Verificar si necesita re-vectorización
        const needsUpdate = 
            contact.linkedinData?.searchedAt && 
            existingVectorized.vectorizedAt &&
            contact.linkedinData.searchedAt.toMillis() > existingVectorized.vectorizedAt.toMillis()

        if (needsUpdate || existingVectorized.vectorVersion !== 'text-embedding-3-small') {
            logger.info('Re-vectorizing contact due to updated information', {
                jid: contact.jid,
                reason: needsUpdate ? 'updated linkedin data' : 'old vector version'
            })
            
            return await vectorizeContact(contact)
        }

        return false

    } catch (error) {
        logger.error('❌ Failed to revectorize contact', error, { jid: contact.jid })
        return false
    }
} 