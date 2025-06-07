import * as functions from 'firebase-functions/v1';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { ContactStatus } from './types/interfaces';
import { vectorizeCompletedContact } from './services/vectorization';

// Inicializar Firebase Admin
admin.initializeApp();

/**
 * Cloud Function que escucha cambios en la colección 'contacts'
 * y vectoriza automáticamente los contactos cuando su estado cambia a 'completed'
 */
export const onContactStatusChange = functions.firestore
  .document('contacts/{contactId}')
  .onUpdate(async (change, context) => {
    const before = change.before;
    const after = change.after;
    const contactId = context.params.contactId;

    try {
      if (!before || !after || !contactId) {
        return null;
      }

      const beforeData = before.data();
      const afterData = after.data();

      // Verificar si el estado cambió a 'completed'
      const statusChanged = beforeData?.status !== afterData?.status;
      const isNowCompleted = afterData?.status === ContactStatus.COMPLETED;

      if (!statusChanged || !isNowCompleted) {
        // No hay cambio relevante, salir
        return null;
      }

      logger.info('Contact status changed to completed, starting vectorization', {
        contactId,
        contactName: afterData?.name,
        previousStatus: beforeData?.status,
        newStatus: afterData?.status
      });

      // Vectorizar el contacto
      const result = await vectorizeCompletedContact(contactId, afterData);

      if (result.success) {
        logger.info('Contact vectorized successfully', {
          contactId,
          contactName: afterData?.name,
          vectorDimension: result.vectorDimension,
          embeddingText: result.embeddingText
        });
      } else {
        logger.warn('Contact vectorization failed', {
          contactId,
          contactName: afterData?.name,
          reason: result.reason
        });
      }

      return result;

    } catch (error) {
      logger.error('Error in contact status change handler', {
        contactId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // No re-lanzar el error para evitar que la función falle
      return { success: false, reason: 'Internal error' };
    }
  });

/**
 * Cloud Function para vectorizar manualmente un contacto específico
 */
export const vectorizeContact = functions.https.onCall(async (data, context) => {
  try {
    const { contactId } = data;

    if (!contactId) {
      throw new functions.https.HttpsError('invalid-argument', 'contactId is required');
    }

    logger.info('Manual vectorization requested', { contactId });

    // Obtener el contacto de Firestore
    const contactDoc = await admin.firestore().collection('contacts').doc(contactId).get();

    if (!contactDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Contact not found');
    }

    const contactData = contactDoc.data();
    const result = await vectorizeCompletedContact(contactId, contactData);

    logger.info('Manual vectorization completed', {
      contactId,
      success: result.success,
      reason: result.reason
    });

    return result;

  } catch (error) {
    logger.error('Error in manual vectorization', error);
    throw error;
  }
});

/**
 * Cloud Function para vectorizar contactos en lotes
 */
export const vectorizeBatch = functions.https.onCall(async (data, context) => {
  try {
    const { limit = 20, forceRevectorize = false } = data;

    if (limit > 100) {
      throw new functions.https.HttpsError('invalid-argument', 'Limit cannot exceed 100');
    }

    logger.info('Batch vectorization started', { limit, forceRevectorize });

    const db = admin.firestore();
    
    // Obtener contactos completados
    const query = db.collection('contacts')
      .where('status', '==', ContactStatus.COMPLETED)
      .limit(limit);

    const contactsSnapshot = await query.get();

    if (contactsSnapshot.empty) {
      return {
        success: true,
        processed: 0,
        message: 'No completed contacts found to vectorize'
      };
    }

    let processed = 0;
    let successful = 0;
    const results = [];

    // Procesar contactos en serie para evitar sobrecargar la API
    for (const doc of contactsSnapshot.docs) {
      const contactData = doc.data();
      const contactId = doc.id;

      try {
        // Verificar si ya está vectorizado (a menos que sea forzado)
        if (!forceRevectorize) {
          const vectorizedDoc = await db.collection('vectorized-contacts').doc(contactId).get();
          if (vectorizedDoc.exists) {
            continue; // Ya está vectorizado, saltar
          }
        }

        const result = await vectorizeCompletedContact(contactId, contactData);
        
        results.push({
          contactId,
          name: contactData.name,
          success: result.success,
          reason: result.reason
        });

        if (result.success) {
          successful++;
        }

        processed++;

        // Pausa pequeña entre procesamiento para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        logger.error('Error processing contact in batch', {
          contactId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        results.push({
          contactId,
          name: contactData.name,
          success: false,
          reason: 'Processing error'
        });
        processed++;
      }
    }

    logger.info('Batch vectorization completed', {
      total: contactsSnapshot.size,
      processed,
      successful,
      failed: processed - successful
    });

    return {
      success: true,
      total: contactsSnapshot.size,
      processed,
      successful,
      failed: processed - successful,
      results
    };

  } catch (error) {
    logger.error('Error in batch vectorization', error);
    throw error;
  }
});

/**
 * Cloud Function programada para vectorización automática
 * Se ejecuta cada hora para procesar contactos que puedan haberse perdido
 */
export const scheduledVectorization = functions.pubsub
  .schedule('every 60 minutes')
  .onRun(async (context) => {
    try {
      logger.info('Scheduled vectorization started');

      const db = admin.firestore();
      
      // Obtener contactos completados que no han sido vectorizados
      const contactsSnapshot = await db.collection('contacts')
        .where('status', '==', ContactStatus.COMPLETED)
        .limit(10) // Procesar máximo 10 por ejecución programada
        .get();

      if (contactsSnapshot.empty) {
        logger.info('No contacts to vectorize in scheduled run');
        return;
      }

      const vectorizedSnapshot = await db.collection('vectorized-contacts')
        .select('jid')
        .get();
      
      const vectorizedJids = new Set(vectorizedSnapshot.docs.map(doc => doc.id));

      let processed = 0;
      let successful = 0;

      for (const doc of contactsSnapshot.docs) {
        const contactData = doc.data();
        const contactId = doc.id;

        // Saltar si ya está vectorizado
        if (vectorizedJids.has(contactId)) {
          continue;
        }

        try {
          const result = await vectorizeCompletedContact(contactId, contactData);
          
          if (result.success) {
            successful++;
          }
          
          processed++;

          // Pausa entre procesamiento
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
          logger.error('Error in scheduled vectorization', {
            contactId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          processed++;
        }
      }

      logger.info('Scheduled vectorization completed', {
        processed,
        successful,
        failed: processed - successful
      });

    } catch (error) {
      logger.error('Error in scheduled vectorization', error);
    }
  }); 