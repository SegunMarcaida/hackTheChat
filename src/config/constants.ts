// Application constants
export const CONSTANTS = {
    // URLs
    DOMAIN: process.env.DOMAIN || 'localhost:8081',
    
    // Terms and Conditions
    get TERMS_AND_CONDITIONS_URL() {
        return `https://${this.DOMAIN}/terms`
    },
    
    // Other constants can be added here
    APP_NAME: 'Axiom',
    VERSION: '1.0.0'
} as const

export type Constants = typeof CONSTANTS 