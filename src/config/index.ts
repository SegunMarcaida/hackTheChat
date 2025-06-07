import { Browsers } from 'baileys'

export const config = {
    // Session
    session: {
        sessionPath: process.env.SESSION_NAME || 'auth_info_baileys'
    },

    // Baileys
    baileys: {
        browser: Browsers.macOS('Chrome'),
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        keepAliveIntervalMs: 60000,
        qrTimeout: 40000
    },

    // Server
    server: {
        port: parseInt(process.env.PORT || '8081')
    },

    // Bot
    bot: {
        name: process.env.BOT_NAME || 'HackTheChat',
        aiEnabled: process.env.AI_ENABLED === 'true'
    },

    // OpenAI
    ai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        systemPrompt: process.env.AI_SYSTEM_PROMPT || ''
    },

    // Firebase/Firestore
    firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID || '',
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
        databaseURL: process.env.FIREBASE_DATABASE_URL || ''
    },

    // Logging
    logs: {
        level: process.env.LOG_LEVEL || 'info',
        colorize: true,
        timestamp: true
    }
}

export type Config = typeof config
