import admin from 'firebase-admin'

// Estados del flujo de bienvenida
export enum ContactStatus {
    NEW = 'new',                           // Contacto recién registrado
    WELCOME_SENT = 'welcome_sent',         // Mensaje de bienvenida enviado
    WAITING_EMAIL = 'waiting_email',       // Esperando que proporcione email
    EMAIL_RECEIVED = 'email_received',     // Email recibido, buscando LinkedIn
    LINKEDIN_FOUND = 'linkedin_found',     // LinkedIn encontrado, preguntando por llamada
    WAITING_CALL_PERMISSION = 'waiting_call_permission', // Esperando permiso para llamar
    CALL_SCHEDULED = 'call_scheduled',     // Llamada programada
    COMPLETED = 'completed'                // Flujo completado
}

// Interfaz para representar un contacto en la base de datos
export interface Contact {
    jid: string                                   // WhatsApp ID único del contacto
    name: string | null                           // Nombre del contacto (puede ser null)
    number: string | null                         // Número de teléfono (puede ser null)
    email?: string | null                         // Email del contacto
    linkedinProfile?: string | null               // URL del perfil de LinkedIn
    linkedinData?: LinkedInProfile | null         // Datos enriquecidos de LinkedIn
    status?: ContactStatus                        // Estado del flujo de bienvenida
    callPermission?: boolean                      // Si dio permiso para llamar
    callScheduled?: boolean                       // Si se programó una llamada
    lastMessageAt: admin.firestore.Timestamp      // Timestamp del último mensaje
    createdAt?: admin.firestore.Timestamp         // Timestamp de creación del contacto
    updatedAt?: admin.firestore.Timestamp         // Timestamp de última actualización
}

// Interfaz para crear un contacto (sin timestamps automáticos)
export interface CreateContactData {
    jid: string
    name: string | null
    number: string | null
    email?: string | null
    linkedinProfile?: string | null
    linkedinData?: LinkedInProfile | null
    status?: ContactStatus
    callPermission?: boolean
    callScheduled?: boolean
    lastMessageAt: admin.firestore.Timestamp
}

// Interfaz para actualizar un contacto (todos los campos opcionales excepto jid)
export interface UpdateContactData {
    jid: string
    name?: string | null
    number?: string | null
    email?: string | null
    linkedinProfile?: string | null
    linkedinData?: LinkedInProfile | null
    status?: ContactStatus
    callPermission?: boolean
    callScheduled?: boolean
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

// Interfaz para datos de LinkedIn
export interface LinkedInProfile {
    name: string
    headline: string
    location?: string
    company?: string
    experience?: string[]
    education?: string[]
    profileUrl: string
    searchedAt: admin.firestore.Timestamp
}
