import OpenAI from 'openai'
import { config } from '../config/index.js'
import { createLogger } from '../logger/index.js'
import { Contact, LinkedInProfile, VectorizationResult } from '../interfaces.js'

const logger = createLogger('Vectorization')

let openaiClient: OpenAI | null = null

if (config.ai.apiKey) {
    openaiClient = new OpenAI({ apiKey: config.ai.apiKey })
}

/**
 * Genera un embedding vector para un contacto basado en sus intereses e información
 * @param contact - Información del contacto
 * @returns Vector embedding del contacto
 */
export async function generateContactVector(contact: Contact): Promise<VectorizationResult> {
    try {
        if (!openaiClient) {
            throw new Error('OpenAI API key is missing. Cannot generate contact vector.')
        }

        // Construir el texto descriptivo del contacto
        const contactText = buildContactDescription(contact)
        
        if (!contactText.trim()) {
            return {
                vector: [],
                textUsed: '',
                success: false,
                error: 'No sufficient information to vectorize contact'
            }
        }

        // Generar embedding usando OpenAI
        const response = await openaiClient.embeddings.create({
            model: 'text-embedding-3-small', // Más eficiente y económico
            input: contactText,
            encoding_format: 'float'
        })

        const vector = response.data[0].embedding

        logger.info('✅ Contact vector generated successfully', {
            contactJid: contact.jid,
            contactName: contact.name,
            vectorDimension: vector.length,
            textLength: contactText.length
        })

        return {
            vector,
            textUsed: contactText,
            success: true
        }

    } catch (error) {
        logger.error('❌ Failed to generate contact vector', error, {
            contactJid: contact.jid,
            contactName: contact.name
        })

        return {
            vector: [],
            textUsed: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

/**
 * Construye una descripción textual del contacto para vectorización
 * @param contact - Información del contacto
 * @returns Texto descriptivo del contacto
 */
function buildContactDescription(contact: Contact): string {
    const parts: string[] = []

    // Información básica
    if (contact.name) {
        parts.push(`Name: ${contact.name}`)
    }

    // Información de LinkedIn si está disponible
    if (contact.linkedinData) {
        const linkedin = contact.linkedinData
        
        if (linkedin.headline) {
            parts.push(`Professional Title: ${linkedin.headline}`)
        }
        
        if (linkedin.company) {
            parts.push(`Company: ${linkedin.company}`)
        }
        
        if (linkedin.location) {
            parts.push(`Location: ${linkedin.location}`)
        }
        
        if (linkedin.experience && linkedin.experience.length > 0) {
            parts.push(`Experience: ${linkedin.experience.join(', ')}`)
        }
        
        if (linkedin.education && linkedin.education.length > 0) {
            parts.push(`Education: ${linkedin.education.join(', ')}`)
        }
    }

    // Información adicional del email (dominio puede indicar industria)
    if (contact.email) {
        const emailDomain = contact.email.split('@')[1]
        if (emailDomain && !isCommonEmailDomain(emailDomain)) {
            parts.push(`Email Domain: ${emailDomain}`)
        }
    }

    return parts.join(' | ')
}

/**
 * Verifica si un dominio de email es común (gmail, outlook, etc.)
 */
function isCommonEmailDomain(domain: string): boolean {
    const commonDomains = [
        'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 
        'icloud.com', 'live.com', 'msn.com', 'protonmail.com'
    ]
    return commonDomains.includes(domain.toLowerCase())
}

/**
 * Genera un vector para una consulta de búsqueda
 * @param query - Texto de búsqueda (ej: "desarrollador web", "marketing digital")
 * @returns Vector embedding de la consulta
 */
export async function generateQueryVector(query: string): Promise<VectorizationResult> {
    try {
        if (!openaiClient) {
            throw new Error('OpenAI API key is missing. Cannot generate query vector.')
        }

        if (!query.trim()) {
            return {
                vector: [],
                textUsed: '',
                success: false,
                error: 'Query cannot be empty'
            }
        }

        const response = await openaiClient.embeddings.create({
            model: 'text-embedding-3-small',
            input: query,
            encoding_format: 'float'
        })

        const vector = response.data[0].embedding

        logger.info('✅ Query vector generated successfully', {
            query,
            vectorDimension: vector.length
        })

        return {
            vector,
            textUsed: query,
            success: true
        }

    } catch (error) {
        logger.error('❌ Failed to generate query vector', error, { query })

        return {
            vector: [],
            textUsed: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

/**
 * Calcula la similitud coseno entre dos vectores
 * @param vectorA - Primer vector
 * @param vectorB - Segundo vector
 * @returns Similitud coseno (0-1, donde 1 es idéntico)
 */
export function calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
        throw new Error('Vectors must have the same dimension')
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < vectorA.length; i++) {
        dotProduct += vectorA[i] * vectorB[i]
        normA += vectorA[i] * vectorA[i]
        normB += vectorB[i] * vectorB[i]
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
    
    if (magnitude === 0) {
        return 0
    }

    return dotProduct / magnitude
} 