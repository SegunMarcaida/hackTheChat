import * as admin from 'firebase-admin';

// Estados del flujo de bienvenida
export enum ContactStatus {
    NEW = 'new',
    WELCOME_SENT = 'welcome_sent',
    WAITING_EMAIL = 'waiting_email',
    EMAIL_RECEIVED = 'email_received',
    LINKEDIN_FOUND = 'linkedin_found',
    WAITING_CALL_PERMISSION = 'waiting_call_permission',
    CALL_SCHEDULED = 'call_scheduled',
    COMPLETED = 'completed'
}

// Interfaz para datos de LinkedIn
export interface LinkedInProfile {
    name: string;
    headline: string;
    location?: string;
    company?: string;
    experience?: string[];
    education?: string[];
    profileUrl: string;
    searchedAt: admin.firestore.Timestamp;
}

// Interfaz para representar un contacto en la base de datos
export interface Contact {
    jid: string;
    name: string | null;
    number: string | null;
    email?: string | null;
    linkedinProfile?: string | null;
    linkedinData?: LinkedInProfile | null;
    status?: ContactStatus;
    callPermission?: boolean;
    callScheduled?: boolean;
    lastMessageAt: admin.firestore.Timestamp;
    createdAt?: admin.firestore.Timestamp;
    updatedAt?: admin.firestore.Timestamp;
}

// Interfaz para contacto vectorizado
export interface VectorizedContact {
    jid: string;
    name: string | null;
    number: string | null;
    email?: string | null;
    linkedinProfile?: string | null;
    linkedinData?: LinkedInProfile | null;
    embeddingVector: number[];
    embeddingText: string;
    vectorizedAt: admin.firestore.Timestamp;
    vectorVersion: string;
    createdAt: admin.firestore.Timestamp;
    updatedAt: admin.firestore.Timestamp;
}

// Interfaz para resultado de vectorización
export interface VectorizationResult {
    success: boolean;
    reason?: string;
    vectorDimension?: number;
    embeddingText?: string;
} 