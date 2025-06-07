import { Contact } from '../interfaces.js'
import { createLogger } from '../logger/index.js'
import { enrichLinkedInData } from '../routes/contact-enrichment.js'

const logger = createLogger('LinkedInService')

/**
 * LinkedIn profile search result
 */
export interface LinkedInSearchResult {
    found: boolean
    profileUrl?: string
    enrichedData?: Contact
    error?: string
}

/**
 * Search for a LinkedIn profile by email using contact enrichment
 */
export async function searchLinkedInProfile(contact: Contact): Promise<LinkedInSearchResult | null> {
    try {
        logger.info('🔍 Searching LinkedIn profile using enrichment service', { contactId: contact.id })

        // ------------------------------------------------------------------
        // 1. Determine LinkedIn URL
        // ------------------------------------------------------------------
        let linkedinUrl: string | null = contact.linkedin || contact.linkedinProfile || null

        // If the contact does not yet have a LinkedIn URL but we do have an
        // email address, attempt to generate one heuristically (legacy logic).
        if (!linkedinUrl && contact.email) {
            linkedinUrl = await findLinkedInUrlByEmail(contact.email)
        }

        if (!linkedinUrl) {
            logger.info('📭 No LinkedIn URL could be resolved for contact', {
                contactId: contact.id,
                email: contact.email || 'none'
            })
            return { found: false }
        }

        // ------------------------------------------------------------------
        // 2. Build contact payload for enrichment (ensure linkedin field set)
        // ------------------------------------------------------------------
        const contactForEnrichment: Contact = {
            ...contact,
            linkedin: linkedinUrl,
            linkedinProfile: linkedinUrl
        }

        // ------------------------------------------------------------------
        // 3. Enrich contact using LinkedIn data
        // ------------------------------------------------------------------
        const enrichedContact = await enrichLinkedInData(contactForEnrichment)

        // ------------------------------------------------------------------
        // 4. Return result based on enrichment outcome
        // ------------------------------------------------------------------
        if (enrichedContact.linkedinEnrichmentResponse) {
            logger.info('✅ LinkedIn profile found and enriched', {
                contactId: contact.id,
                profileName: `${enrichedContact.firstName || ''} ${enrichedContact.lastName || ''}`.trim(),
                company: enrichedContact.company,
                jobTitle: enrichedContact.jobTitle
            })

            return {
                found: true,
                profileUrl: linkedinUrl,
                enrichedData: enrichedContact
            }
        } else {
            logger.info('📭 LinkedIn enrichment did not return data', { contactId: contact.id })
            return { found: false }
        }

    } catch (error) {
        logger.error('❌ Error searching LinkedIn profile', error, { contactId: contact.id })
        return {
            found: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

/**
 * Find a LinkedIn URL by searching for contacts with the same email
 * This is a simplified approach - in a real implementation, you might use
 * a LinkedIn search API or email-to-LinkedIn mapping service
 */
async function findLinkedInUrlByEmail(email: string): Promise<string | null> {
    try {
        // For demo purposes, generate a LinkedIn URL based on email
        // In a real implementation, you would:
        // 1. Search your database for existing contacts with this email
        // 2. Use a LinkedIn API to search by email
        // 3. Use a people data enrichment service
        
        const username = email.split('@')[0].toLowerCase().replace(/[._]/g, '-')
        const linkedinUrl = `https://linkedin.com/in/${username}`
        
        logger.info('Generated LinkedIn URL from email', { email, linkedinUrl })
        return linkedinUrl
        
    } catch (error) {
        logger.error('Error finding LinkedIn URL', error, { email })
        return null
    }
}

/**
 * Legacy mock functions for backward compatibility
 */

/**
 * Extract name from email (first part before @)
 */
function extractNameFromEmail(email: string): string {
    const username = email.split('@')[0]
    // Convert dots and underscores to spaces and capitalize
    return username
        .replace(/[._]/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase())
}

/**
 * Generate mock headline
 */
function generateMockHeadline(): string {
    const headlines = [
        'Senior Software Engineer at Tech Corp',
        'Marketing Manager | Digital Strategy Expert',
        'Product Manager | Building the Future',
        'Data Scientist | AI & Machine Learning',
        'Entrepreneur | Startup Founder',
        'Sales Director | B2B Growth Specialist',
        'UX Designer | Creating Beautiful Experiences',
        'Consultant | Strategy & Operations',
        'Full Stack Developer | React & Node.js',
        'Business Analyst | Process Optimization'
    ]
    return headlines[Math.floor(Math.random() * headlines.length)]
}

/**
 * Generate mock location
 */
function generateMockLocation(): string {
    const locations = [
        'San Francisco, CA',
        'New York, NY',
        'London, UK',
        'Toronto, Canada',
        'Austin, TX',
        'Seattle, WA',
        'Berlin, Germany',
        'Amsterdam, Netherlands',
        'Sydney, Australia',
        'Remote'
    ]
    return locations[Math.floor(Math.random() * locations.length)]
}

/**
 * Generate mock company
 */
function generateMockCompany(): string {
    const companies = [
        'Google',
        'Microsoft',
        'Apple',
        'Amazon',
        'Meta',
        'Netflix',
        'Salesforce',
        'Stripe',
        'Airbnb',
        'Uber',
        'TechStart Inc',
        'InnovateCorp',
        'Digital Solutions Ltd'
    ]
    return companies[Math.floor(Math.random() * companies.length)]
}

/**
 * Generate mock experience
 */
function generateMockExperience(): string[] {
    const experiences = [
        'Senior Software Engineer at Current Company (2021-Present)',
        'Software Engineer at Previous Corp (2019-2021)',
        'Junior Developer at StartupXYZ (2018-2019)',
        'Intern at Tech Solutions (2017-2018)'
    ]
    // Return 2-4 random experiences
    const count = Math.floor(Math.random() * 3) + 2
    return experiences.slice(0, count)
}

/**
 * Generate mock education
 */
function generateMockEducation(): string[] {
    const education = [
        'Bachelor of Computer Science, Stanford University',
        'Master of Business Administration, Harvard Business School',
        'Bachelor of Engineering, MIT',
        'Master of Science in Data Science, UC Berkeley'
    ]
    // Return 1-2 education entries
    const count = Math.floor(Math.random() * 2) + 1
    return education.slice(0, count)
}

/**
 * Generate mock LinkedIn username
 */
function generateMockUsername(email: string): string {
    const username = email.split('@')[0].toLowerCase()
    return username.replace(/[._]/g, '-')
} 