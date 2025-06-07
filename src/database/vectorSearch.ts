import { db } from './firestore.js'
import { VectorizedContact, SimilarContactResult, Contact } from '../interfaces.js'
import { createLogger } from '../logger/index.js'

const logger = createLogger('VectorSearch')

/**
 * Calculates cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
        throw new Error('Vectors must have the same length')
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i]
        normA += vecA[i] * vecA[i]
        normB += vecB[i] * vecB[i]
    }

    if (normA === 0 || normB === 0) {
        return 0
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Finds the top match for a given query vector using cosine similarity
 * @param queryVector The vector to find matches for
 * @param minSimilarity Minimum similarity threshold (0-1)
 * @returns The top matching contact with similarity score, or null if no matches found
 */
export async function findTopMatch(
    queryVector: number[],
    minSimilarity: number = 0.3
): Promise<SimilarContactResult | null> {
    try {
        if (!db) {
            logger.warn('Firestore not initialized')
            return null
        }

        // Get all vectorized contacts
        const snapshot = await db.collection('contacts').get()
        const contacts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Contact[]

        if (contacts.length === 0) {
            logger.info('No vectorized contacts found')
            return null
        }

        // Calculate similarities and find top match
        let topMatch: SimilarContactResult | null = null
        let highestSimilarity = minSimilarity

        for (const contact of contacts) {
            if (!contact.embedding) continue

            const similarity = cosineSimilarity(queryVector, contact.embedding)
            
            if (similarity > highestSimilarity) {
                highestSimilarity = similarity
                topMatch = {
                    contact,
                    similarity
                }
            }
        }

        if (topMatch) {
            logger.info('Found top match', {
                contactJid: topMatch.contact.jid,
                similarity: topMatch.similarity
            })
        } else {
            logger.info('No matches found above similarity threshold', {
                minSimilarity
            })
        }

        return topMatch
    } catch (error) {
        logger.error('Error finding top match', error)
        return null
    }
}

/**
 * Finds the top match for a given contact JID
 * @param jid The JID of the contact to find matches for
 * @param minSimilarity Minimum similarity threshold (0-1)
 * @returns The top matching contact with similarity score, or null if no matches found
 */
export async function findTopMatchByJid(
    jid: string,
    minSimilarity: number = 0.3
): Promise<SimilarContactResult | null> {
    try {
        if (!db) {
            logger.warn('Firestore not initialized')
            return null
        }

        // Get the source contact's vector
        const sourceDoc = await db.collection('vectorizedContacts').doc(jid).get()
        if (!sourceDoc.exists) {
            logger.info('Source contact not found', { jid })
            return null
        }

        const sourceContact = sourceDoc.data() as Contact
        if (!sourceContact.embedding) {
            logger.info('Source contact has no embedding vector', { jid })
            return null
        }

        // Find top match excluding the source contact
        const snapshot = await db.collection('vectorizedContacts')
            .where('jid', '!=', jid)
            .get()

        const contacts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Contact[]

        if (contacts.length === 0) {
            logger.info('No other vectorized contacts found')
            return null
        }

        // Calculate similarities and find top match
        let topMatch: SimilarContactResult | null = null
        let highestSimilarity = minSimilarity

        for (const contact of contacts) {
            if (!contact.embedding) continue

            const similarity = cosineSimilarity(sourceContact.embedding, contact.embedding)
            
            if (similarity > highestSimilarity) {
                highestSimilarity = similarity
                topMatch = {
                    contact,
                    similarity
                }
            }
        }

        if (topMatch) {
            logger.info('Found top match for contact', {
                sourceJid: jid,
                matchJid: topMatch.contact.jid,
                similarity: topMatch.similarity
            })
        } else {
            logger.info('No matches found above similarity threshold', {
                jid,
                minSimilarity
            })
        }

        return topMatch
    } catch (error) {
        logger.error('Error finding top match by JID', error)
        return null
    }
} 