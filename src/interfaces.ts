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
    firstName?: string
    lastName?: string
    location?: {
        city?: string
        country?: string
        state?: string
    }
    jobTitle?: string
    linkedinEnrichmentResponse?: LinkedInResponse
    company?: string
    id: string                                    // WhatsApp ID único del contacto
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
    linkedin?: string      
    lastEnrichedAt?: Date | admin.firestore.Timestamp | any;
    img?: string
    jobHistory?: JobHistory[]
    educationHistory?: EducationHistory[]
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

export interface LinkedInResponse {
    accomplishment_projects: AccomplishmentProject[];
    accomplishment_publications: any[];
    accomplishment_test_scores: any[];
    interests: string[];
    // activities: Activity[];
    // articles: any[];
    background_cover_image_url: string;
    certifications: Certification[];
    city: string;
    connections: number;
    country: string;
    country_full_name: string;
    education: LinkedInEducation[];
    experiences: LinkedInExperience[];
    first_name: string;
    follower_count: number | null;
    full_name: string;
    // groups: any[];
    headline: string;
    last_name: string;
    occupation: string;
    people_also_viewed: any[];
    profile_pic_url: string;
    public_identifier: string;
    // recommendations: string[];
    // similarly_named_profiles: SimilarlyNamedProfile[];
    state: string;
    summary: string;
    volunteer_work: any[];
  }

  export interface AccomplishmentProject {
    description: string;
    ends_at: LinkedInDate | null;
    starts_at: LinkedInDate;
    title: string;
    url: string;
  }
  export interface LinkedInDate {
    year: number;
    month: number;
    day?: number;
  }

  export interface LinkedInDate {
    year: number;
    month: number;
    day?: number;
  }
  
  export interface Certification {
    authority: string;
    display_source: string | null;
    ends_at: LinkedInDate | null;
    license_number: string | null;
    name: string;
    starts_at: LinkedInDate | null;
    url: string | null;
  }
  
  export interface LinkedInEducation {
    activities_and_societies: string | null;
    degree_name: string | null;
    description: string | null;
    ends_at: LinkedInDate | null;
    field_of_study: string;
    grade: string | null;
    logo_url: string;
    school: string;
    school_facebook_profile_url: string | null;
    school_linkedin_profile_url: string | null;
    starts_at: LinkedInDate;
  }
  
  export interface LinkedInExperience {
    company: string;
    company_facebook_profile_url: string | null;
    company_linkedin_profile_url: string | null;
    description: string;
    ends_at: LinkedInDate | null;
    location: string | null;
    logo_url: string;
    starts_at: LinkedInDate;
    title: string;
  }

  export interface JobHistory {
    id?: string;
    organizationId: string | null;
    jobTitle: string
    companyName: string
    companyLogo: string
    companyType?: 'gomry_organization' | 'clearbit' | 'manual'
    startDate: string // "2020-08"
    endDate: string // "2025-08"
    location: string
    employmentType?: string
    description?: string
    jobResponsibilities?: string
    isCurrentRole: boolean
    companyLinkedinUrl?: string;
    workEmail?: string;
  }

  export interface EducationHistory {
    id?: string;
    institutionName?: string;
    institutionLogo?: string;
    institutionType?: "gomry_organization" | "clearbit" | "manual";
    degreeOrCertificate?: string; // "Bachelor of Science"
    fieldOfStudy?: string; // "Computer Science"
    grade?: string; // "3.8"
    startDate?: string; // "2020-08"
    endDate?: string; // "2025-08"
    description?: string;
    educationEmail?: string;
    organizationId?: string;
    institutionLinkedinUrl?: string;
  }
>>>>>>> d7a249f (scrape linkedin endpoint)


export interface LinkedInResponse {
    accomplishment_projects: AccomplishmentProject[];
    accomplishment_publications: any[];
    accomplishment_test_scores: any[];
    interests: string[];
    // activities: Activity[];
    // articles: any[];
    background_cover_image_url: string;
    certifications: Certification[];
    city: string;
    connections: number;
    country: string;
    country_full_name: string;
    education: LinkedInEducation[];
    experiences: LinkedInExperience[];
    first_name: string;
    follower_count: number | null;
    full_name: string;
    // groups: any[];
    headline: string;
    last_name: string;
    occupation: string;
    people_also_viewed: any[];
    profile_pic_url: string;
    public_identifier: string;
    // recommendations: string[];
    // similarly_named_profiles: SimilarlyNamedProfile[];
    state: string;
    summary: string;
    volunteer_work: any[];
  }

  export interface AccomplishmentProject {
    description: string;
    ends_at: LinkedInDate | null;
    starts_at: LinkedInDate;
    title: string;
    url: string;
  }
  export interface LinkedInDate {
    year: number;
    month: number;
    day?: number;
  }

  export interface LinkedInDate {
    year: number;
    month: number;
    day?: number;
  }
  
  export interface Certification {
    authority: string;
    display_source: string | null;
    ends_at: LinkedInDate | null;
    license_number: string | null;
    name: string;
    starts_at: LinkedInDate | null;
    url: string | null;
  }
  
  export interface LinkedInEducation {
    activities_and_societies: string | null;
    degree_name: string | null;
    description: string | null;
    ends_at: LinkedInDate | null;
    field_of_study: string;
    grade: string | null;
    logo_url: string;
    school: string;
    school_facebook_profile_url: string | null;
    school_linkedin_profile_url: string | null;
    starts_at: LinkedInDate;
  }
  
  export interface LinkedInExperience {
    company: string;
    company_facebook_profile_url: string | null;
    company_linkedin_profile_url: string | null;
    description: string;
    ends_at: LinkedInDate | null;
    location: string | null;
    logo_url: string;
    starts_at: LinkedInDate;
    title: string;
  }

  export interface JobHistory {
    id?: string;
    organizationId: string | null;
    jobTitle: string
    companyName: string
    companyLogo: string
    companyType?: 'gomry_organization' | 'clearbit' | 'manual'
    startDate: string // "2020-08"
    endDate: string // "2025-08"
    location: string
    employmentType?: string
    description?: string
    jobResponsibilities?: string
    isCurrentRole: boolean
    companyLinkedinUrl?: string;
    workEmail?: string;
  }

  export interface EducationHistory {
    id?: string;
    institutionName?: string;
    institutionLogo?: string;
    institutionType?: "gomry_organization" | "clearbit" | "manual";
    degreeOrCertificate?: string; // "Bachelor of Science"
    fieldOfStudy?: string; // "Computer Science"
    grade?: string; // "3.8"
    startDate?: string; // "2020-08"
    endDate?: string; // "2025-08"
    description?: string;
    educationEmail?: string;
    organizationId?: string;
    institutionLinkedinUrl?: string;
  }