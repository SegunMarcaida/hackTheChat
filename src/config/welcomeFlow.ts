/**
 * Configuración del flujo de bienvenida
 */
export const welcomeFlowConfig = {
    // Habilitar o deshabilitar el flujo de bienvenida
    enabled: true,
    
    // Configuración de IA para mensajes dinámicos
    ai: {
        // Usar OpenAI para generar mensajes dinámicos
        enabled: true,
        
        // Fallback a mensajes estáticos si OpenAI falla
        fallbackToStatic: true,
        
        // Timeout para las llamadas a OpenAI (en ms)
        timeout: 10000,
    },
    
    // Mensajes estáticos de fallback (se usan si la IA está deshabilitada o falla)
    messages: {
        greeting: `Hey there, glad you reached out!

Who sent you my way? Always fun to know which friend or connection I owe for the intro.

I help connect interesting people and provide assistance. Before I can work my magic, I'll need your email to properly get to know you and make legitimate connections.

What's the best email for you?`,

        emailRequest: `I'll need your email to properly help you out. What's the best one to reach you at?`,

        emailConfirmation: `Perfect, got it! You're all set now.

Feel free to reach out anytime you need help or have questions. Looking forward to connecting with you!`,

        emailInvalid: `Hmm, that email doesn't look quite right. Mind double-checking and trying again?`,
    },

    // Configuración de comportamiento
    behavior: {
        // Si debe pedir email inmediatamente después del saludo
        requestEmailImmediately: true,
        
        // Tiempo de espera antes de recordar el email (en horas)
        emailReminderAfterHours: 24,
        
        // Máximo número de intentos para un email inválido
        maxEmailAttempts: 3,
        
        // Si debe procesar grupos o solo chats individuales
        processGroups: false,
    },

    // Configuración de validación de email
    emailValidation: {
        // Regex para validar email
        regex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        
        // Dominios bloqueados (ejemplo: temp-mail services)
        blockedDomains: [] as string[],

        // Si debe verificar dominios bloqueados
        checkBlockedDomains: false,
    }
}

/**
 * Valida si un email es válido según la configuración
 */
export function validateEmail(email: string): boolean {
    const config = welcomeFlowConfig.emailValidation
    
    // Validar formato básico
    if (!config.regex.test(email)) {
        return false
    }
    
    // Verificar dominios bloqueados si está habilitado
    if (config.checkBlockedDomains) {
        const domain = email.split('@')[1]?.toLowerCase()
        if (domain && config.blockedDomains.includes(domain)) {
            return false
        }
    }
    
    return true
} 