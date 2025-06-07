import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import OpenAI from 'openai';
import { VectorizedContact, VectorizationResult } from '../types/interfaces';

// Configurar OpenAI
const openaiApiKey = functions.config().openai?.api_key || process.env.OPENAI_API_KEY;
let openaiClient: OpenAI | null = null;

if (openaiApiKey) {
    openaiClient = new OpenAI({ apiKey: openaiApiKey });
}

/**
 * Vectoriza un contacto completado y lo guarda en la colección vectorized-contacts
 */
export async function vectorizeCompletedContact(
    contactId: string, 
    contactData: any
): Promise<VectorizationResult> {
    try {
        if (!openaiClient) {
            return {
                success: false,
                reason: 'OpenAI API key not configured'
            };
        }

        // Verificar que tiene información suficiente para vectorizar
        const hasLinkedInData = contactData.linkedinData && (
            contactData.linkedinData.headline || 
            contactData.linkedinData.company || 
            contactData.linkedinData.experience
        );
        
        const hasEmail = contactData.email && contactData.email.includes('@');

        if (!hasLinkedInData && !hasEmail) {
            return {
                success: false,
                reason: 'Insufficient information to vectorize (no LinkedIn data or email)'
            };
        }

        // Construir texto descriptivo del contacto
        const contactText = buildContactDescription(contactData);
        
        if (!contactText.trim()) {
            return {
                success: false,
                reason: 'Failed to build contact description'
            };
        }

        functions.logger.info('Generating embedding for contact', {
            contactId,
            contactName: contactData.name,
            textLength: contactText.length
        });

        // Generar embedding usando OpenAI
        const response = await openaiClient.embeddings.create({
            model: 'text-embedding-3-small',
            input: contactText,
            encoding_format: 'float'
        });

        const vector = response.data[0].embedding;

        // Crear documento vectorizado
        const vectorizedContact: VectorizedContact = {
            jid: contactData.jid,
            name: contactData.name,
            number: contactData.number,
            email: contactData.email || null,
            linkedinProfile: contactData.linkedinProfile || null,
            linkedinData: contactData.linkedinData || null,
            embeddingVector: vector,
            embeddingText: contactText,
            vectorizedAt: admin.firestore.Timestamp.now(),
            vectorVersion: 'text-embedding-3-small',
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
        };

        // Guardar en Firestore
        const db = admin.firestore();
        await db.collection('vectorized-contacts')
            .doc(contactId)
            .set(vectorizedContact, { merge: true });

        functions.logger.info('Contact vectorized successfully', {
            contactId,
            contactName: contactData.name,
            vectorDimension: vector.length,
            embeddingText: contactText
        });

        return {
            success: true,
            vectorDimension: vector.length,
            embeddingText: contactText
        };

    } catch (error) {
        functions.logger.error('Error vectorizing contact', {
            contactId,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });

        return {
            success: false,
            reason: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Construye una descripción textual del contacto para vectorización
 */
function buildContactDescription(contact: any): string {
    const parts: string[] = [];

    // Información básica
    if (contact.name) {
        parts.push(`Name: ${contact.name}`);
    }

    // Información de LinkedIn si está disponible
    if (contact.linkedinData) {
        const linkedin = contact.linkedinData;
        
        if (linkedin.headline) {
            parts.push(`Professional Title: ${linkedin.headline}`);
        }
        
        if (linkedin.company) {
            parts.push(`Company: ${linkedin.company}`);
        }
        
        if (linkedin.location) {
            parts.push(`Location: ${linkedin.location}`);
        }
        
        if (linkedin.experience && linkedin.experience.length > 0) {
            parts.push(`Experience: ${linkedin.experience.join(', ')}`);
        }
        
        if (linkedin.education && linkedin.education.length > 0) {
            parts.push(`Education: ${linkedin.education.join(', ')}`);
        }
    }

    // Información adicional del email (dominio puede indicar industria)
    if (contact.email) {
        const emailDomain = contact.email.split('@')[1];
        if (emailDomain ) {
            parts.push(`Email Domain: ${emailDomain}`);
        }
    }

    return parts.join(' | ');
}

