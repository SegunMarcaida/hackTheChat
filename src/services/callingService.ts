import { createLogger } from '../logger/index.js'
import admin from 'firebase-admin'

const logger = createLogger('CallingService')

export interface CallResult {
    success: boolean
    callId?: string
    scheduledFor?: admin.firestore.Timestamp
    duration?: number
    notes?: string
    error?: string
}

/**
 * Mock calling service - simulates scheduling and making a call
 */
export async function scheduleCall(
    contactName: string | null,
    contactNumber: string,
    email: string
): Promise<CallResult> {
    try {
        logger.info('📞 Scheduling call', { contactName, contactNumber, email })
        
        // Simulate scheduling delay
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        // Mock success rate - 95% success
        const success = Math.random() > 0.05
        
        if (!success) {
            const error = 'Unable to reach the contact at this time'
            logger.warn('⚠️ Call scheduling failed', { contactNumber, error })
            return {
                success: false,
                error
            }
        }
        
        // Generate mock call data
        const callId = generateCallId()
        const scheduledFor = admin.firestore.Timestamp.fromMillis(
            Date.now() + Math.random() * 30 * 60 * 1000 // Random time within next 30 minutes
        )
        
        logger.info('✅ Call scheduled successfully', { 
            contactName,
            contactNumber,
            callId,
            scheduledFor: scheduledFor.toDate()
        })
        
        // Simulate actually making the call after a short delay
        setTimeout(() => {
            makeCall(callId, contactName, contactNumber, email)
        }, 5000) // Start call in 5 seconds
        
        return {
            success: true,
            callId,
            scheduledFor
        }
    } catch (error) {
        logger.error('❌ Error scheduling call', error, { contactName, contactNumber })
        return {
            success: false,
            error: 'System error while scheduling call'
        }
    }
}

/**
 * Mock function to simulate making the actual call
 */
async function makeCall(
    callId: string,
    contactName: string | null,
    contactNumber: string,
    email: string
): Promise<CallResult> {
    try {
        logger.info('📱 Initiating call', { callId, contactName, contactNumber })
        
        // Simulate call duration (1-10 minutes)
        const duration = Math.floor(Math.random() * 9 + 1) * 60 // 1-10 minutes in seconds
        
        // Simulate call in progress
        await new Promise(resolve => setTimeout(resolve, 3000)) // Simulate 3 seconds of "calling"
        
        // Mock call success rate - 85%
        const callAnswered = Math.random() > 0.15
        
        if (!callAnswered) {
            logger.info('📵 Call not answered', { callId, contactNumber })
            return {
                success: false,
                callId,
                error: 'Contact did not answer the call'
            }
        }
        
        // Simulate call conversation
        await new Promise(resolve => setTimeout(resolve, duration * 10)) // Simulate duration (scaled down for demo)
        
        const notes = generateCallNotes(contactName)
        
        logger.info('✅ Call completed successfully', { 
            callId,
            contactName,
            duration: `${Math.floor(duration / 60)} minutes`,
            notes: notes.substring(0, 50) + '...'
        })
        
        return {
            success: true,
            callId,
            duration,
            notes
        }
    } catch (error) {
        logger.error('❌ Error during call', error, { callId })
        return {
            success: false,
            callId,
            error: 'Error occurred during the call'
        }
    }
}

/**
 * Generate a unique call ID
 */
function generateCallId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 7)
    return `call_${timestamp}_${random}`
}

/**
 * Generate mock call notes
 */
function generateCallNotes(contactName: string | null): string {
    const scenarios = [
        `Great conversation with ${contactName || 'the contact'}. They're interested in networking opportunities and mentioned they're looking for new projects. Very engaged and professional. Follow up with relevant connections in tech industry.`,
        
        `Productive call. ${contactName || 'Contact'} shared their background in marketing and expressed interest in startup opportunities. They have 5+ years experience and are open to consulting work. Will introduce them to my network.`,
        
        `Excellent networking call. ${contactName || 'Contact'} is a software engineer looking to transition into product management. Discussed their goals and potential mentorship opportunities. They're very motivated and have solid technical background.`,
        
        `Insightful conversation about their business development role. ${contactName || 'Contact'} is interested in expanding their network in the SaaS space. They mentioned several pain points that align with solutions in my network.`,
        
        `Strong call with a potential collaboration opportunity. ${contactName || 'Contact'} runs a consulting firm and is looking for strategic partnerships. Discussed mutual referral opportunities and shared values.`
    ]
    
    return scenarios[Math.floor(Math.random() * scenarios.length)]
}

/**
 * Get call status by ID (for future reference)
 */
export async function getCallStatus(callId: string): Promise<CallResult | null> {
    try {
        logger.info('📋 Getting call status', { callId })
        
        // In a real implementation, this would query a database
        // For now, return mock data
        return {
            success: true,
            callId,
            duration: 300, // 5 minutes
            notes: 'Mock call completed successfully'
        }
    } catch (error) {
        logger.error('❌ Error getting call status', error, { callId })
        return null
    }
} 