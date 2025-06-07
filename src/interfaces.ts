import admin from 'firebase-admin'

// Interfaz para representar un contacto en la base de datos
export interface Contact {
    jid: string                                    // WhatsApp ID único del contacto
    name: string | null                           // Nombre del contacto (puede ser null)
    number: string | null                         // Número de teléfono (puede ser null)
    lastMessageAt: admin.firestore.Timestamp      // Timestamp del último mensaje
    createdAt?: admin.firestore.Timestamp         // Timestamp de creación del contacto
    updatedAt?: admin.firestore.Timestamp         // Timestamp de última actualización
}

// Interfaz para crear un contacto (sin timestamps automáticos)
export interface CreateContactData {
    jid: string
    name: string | null
    number: string | null
    lastMessageAt: admin.firestore.Timestamp
}

// Interfaz para actualizar un contacto (todos los campos opcionales excepto jid)
export interface UpdateContactData {
    jid: string
    name?: string | null
    number?: string | null
    lastMessageAt?: admin.firestore.Timestamp
}

// Interfaz para representar información básica de un contacto extraída de mensajes
export interface ContactInfo {
    name: string | null
    number: string | null
    jid: string
    isGroup: boolean
    groupName: string | null
}
