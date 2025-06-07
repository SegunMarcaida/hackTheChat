import { LinkedInProfile } from '../interfaces.js'
import { createLogger } from '../logger/index.js'
import admin from 'firebase-admin'

const logger = createLogger('LinkedInService')

/**
 * Mock LinkedIn search service - simulates searching for a LinkedIn profile by email
 */
export async function searchLinkedInProfile(email: string, contactName: string | null): Promise<LinkedInProfile | null> {
    try {
        logger.info('🔍 Searching LinkedIn profile', { email, contactName })
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Mock success rate - 80% chance of finding a profile
        const found = Math.random() > 0.2
        
        if (!found) {
            logger.info('📭 LinkedIn profile not found', { email })
            return null
        }
        
        // Generate mock LinkedIn data
        const mockProfile: LinkedInProfile = {
            name: contactName || extractNameFromEmail(email),
            headline: generateMockHeadline(),
            location: generateMockLocation(),
            company: generateMockCompany(),
            experience: generateMockExperience(),
            education: generateMockEducation(),
            profileUrl: `https://linkedin.com/in/${generateMockUsername(email)}`,
            searchedAt: admin.firestore.Timestamp.now()
        }
        
        logger.info('✅ LinkedIn profile found', { 
            email, 
            profileName: mockProfile.name,
            company: mockProfile.company,
            headline: mockProfile.headline
        })
        
        return mockProfile
    } catch (error) {
        logger.error('❌ Error searching LinkedIn profile', error, { email })
        return null
    }
}

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