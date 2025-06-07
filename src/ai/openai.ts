import OpenAI from 'openai'
import { config } from '../config/index.js'
import { LinkedInResponse, Contact, SimilarContactResult } from '../interfaces.js'
import { createLogger } from '../logger/index.js'

const logger = createLogger('OpenAI')

let client: OpenAI | null = null

if (config.ai.apiKey) {
    client = new OpenAI({ apiKey: config.ai.apiKey })
}

export async function generateResponse(prompt: string): Promise<string> {
    if (!client) {
        throw new Error('OpenAI API key is missing. Set OPENAI_API_KEY to enable AI responses.')
    }

    const messages: { role: 'system' | 'user'; content: string }[] = []
    if (config.ai.systemPrompt) {
        messages.push({ role: 'system', content: config.ai.systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    const chat = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages
    })

    return chat.choices[0]?.message?.content?.trim() || ''
}

export async function generateWelcomeMessage(contactName: string | null, contactNumber: string | null): Promise<string> {
    if (!client) {
        throw new Error('OpenAI API key is missing. Cannot generate welcome message.')
    }

    const systemPrompt = `You are a friendly, authentic networking assistant with a casual but professional vibe. You help connect interesting people and provide assistance. Your personality is like a helpful connector who's genuinely curious about people.

INSTRUCTIONS:
- Write in English
- Be casual and authentic (like texting a friend, but professional)
- Always start with a friendly greeting using their name if available
- Mention that you help connect people or provide assistance
- Explain that you need their email to properly help them and make legitimate connections
- Ask for their email in a natural, casual way
- Keep it conversational and not too formal
- Use a warm, approachable tone
- Keep the message concise but personal (around 3-4 sentences)
- Don't use too many emojis - keep it natural

Think of the style like: "Hey [name], glad you reached out! Who sent you my way? I help connect interesting people, but I'll need your email to work my magic properly."

If you have the contact's name, use it personally. If not, be friendly but general.`

    const userPrompt = contactName 
        ? `Generate a welcome message for ${contactName} (number: ${contactNumber})`
        : `Generate a welcome message for a new contact (number: ${contactNumber})`

    const chat = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.8, // More creativity for natural variation
        max_tokens: 200
    })

    return chat.choices[0]?.message?.content?.trim() || ''
}

/**
 * Genera una solicitud de email personalizada
 */
export async function generateEmailRequest(contactName: string | null): Promise<string> {
    if (!client) {
        throw new Error('OpenAI API key is missing. Cannot generate email request.')
    }

    const systemPrompt = `You are a friendly networking assistant. You need to ask for someone's email in a casual, natural way.

INSTRUCTIONS:
- Write in English
- Be casual and friendly
- Explain briefly why you need the email (to properly connect/help them)
- Make it feel natural, not pushy
- Keep it short and conversational
- If you have their name, use it
- Think like: "I'll need your email to properly help you out" or "What's the best email for you?"`

    const userPrompt = contactName 
        ? `Ask ${contactName} for their email in a casual way`
        : `Ask this contact for their email in a casual way`

    const chat = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 80
    })

    return chat.choices[0]?.message?.content?.trim() || ''
}

/**
 * Genera un mensaje compartiendo el perfil de LinkedIn encontrado y pidiendo permiso para llamar
 */
export async function generateLinkedInFoundMessage(contactName: string | null, linkedinProfile: Contact): Promise<string> {
    if (!client) {
        throw new Error('OpenAI API key is missing. Cannot generate LinkedIn message.')
    }
    logger.info('linkedinProfile', { linkedinProfile })

    const systemPrompt = `You are a friendly networking assistant. You found someone's LinkedIn profile and want to ask if you can call them.

INSTRUCTIONS:
- Write in English
- Be brief and direct (1-2 sentences max)
- Mention 1-2 key details from their LinkedIn (company and role)
- Ask if you can call them to learn more
- Keep it casual and friendly
- Use their name if available
- No emojis or excessive enthusiasm`

    const userPrompt = contactName 
        ? `Found ${contactName}'s LinkedIn profile. Profile details: ${linkedinProfile?.linkedinEnrichmentResponse?.headline || linkedinProfile?.jobTitle} in ${linkedinProfile?.linkedinEnrichmentResponse?.city || linkedinProfile?.location?.city}. Ask if you can call them.`
        : `Found contact's LinkedIn profile. Profile details: ${linkedinProfile?.linkedinEnrichmentResponse?.headline || linkedinProfile?.jobTitle} in ${linkedinProfile?.linkedinEnrichmentResponse?.city || linkedinProfile?.location?.city}. Ask if you can call them.`
    logger.info('userPrompt', { userPrompt })
    const chat = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 80
    })

    return chat.choices[0]?.message?.content?.trim() || ''
}

/**
 * Genera un mensaje cuando no se encuentra el perfil de LinkedIn
 */
export async function generateLinkedInNotFoundMessage(contactName: string | null): Promise<string> {
    if (!client) {
        throw new Error('OpenAI API key is missing. Cannot generate LinkedIn not found message.')
    }

    const systemPrompt = `You are a friendly networking assistant. You searched for someone's LinkedIn profile but couldn't find it. You want to let them know and still offer to help.

INSTRUCTIONS:
- Write in English
- Be casual and understanding (not disappointed)
- Mention you searched but couldn't find their LinkedIn
- Offer alternative ways to learn about them
- Ask if they'd like to share their LinkedIn or tell you about themselves
- Keep it positive and helpful
- Make them feel like it's no big deal
- Use their name if available`

    const userPrompt = contactName 
        ? `Couldn't find ${contactName}'s LinkedIn profile. Let them know and ask for alternatives.`
        : `Couldn't find contact's LinkedIn profile. Let them know and ask for alternatives.`

    const chat = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.6,
        max_tokens: 100
    })

    return chat.choices[0]?.message?.content?.trim() || ''
}

/**
 * Genera mensaje confirmando que se va a programar la llamada
 */
export async function generateCallSchedulingMessage(contactName: string | null, termsAndConditionsLink?: string): Promise<string> {
    if (!client) {
        throw new Error('OpenAI API key is missing. Cannot generate call scheduling message.')
    }

    const systemPrompt = `You are Axiom, a friendly networking assistant. Someone agreed to a call and you need to provide them with a phone number to call.

INSTRUCTIONS:
- Write in English
- Be brief and direct (1-2 sentences max)
- Thank them and ask them to call the provided phone number
- Mention terms and conditions acceptance briefly if link is provided
- If a terms link is provided, include it as a plain clickable URL
- Use their name if available
- No excessive emojis or enthusiasm
- Make it clear they should call the number`
    
    const userPrompt = contactName 
        ? `${contactName} agreed to the call. Ask them to call +16672207219.${termsAndConditionsLink ? ` Include this terms and conditions URL as a clickable link: ${termsAndConditionsLink}` : ''}`
        : `Contact agreed to the call. Ask them to call +16672207219.${termsAndConditionsLink ? ` Include this terms and conditions URL as a clickable link: ${termsAndConditionsLink}` : ''}`

    const chat = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.6,
        max_tokens: 80
    })

    return chat.choices[0]?.message?.content?.trim() || ''
}

/**
 * Genera mensaje cuando el usuario rechaza la llamada
 */
export async function generateCallDeclinedMessage(contactName: string | null): Promise<string> {
    if (!client) {
        throw new Error('OpenAI API key is missing. Cannot generate call declined message.')
    }

    const systemPrompt = `You are Axiom, a friendly networking assistant. Someone declined your offer to call them. Respond in an understanding, positive way.

INSTRUCTIONS:
- Write in English
- Be completely understanding (no pressure)
- Thank them for letting you know
- Offer alternative ways to help (email, messages, future calls)
- Keep the door open for future interactions
- Stay positive and helpful
- Make them feel comfortable about saying no
- Use their name if available`

    const userPrompt = contactName 
        ? `${contactName} declined the call. Respond positively and offer alternatives.`
        : `Contact declined the call. Respond positively and offer alternatives.`

    const chat = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 100
    })

    return chat.choices[0]?.message?.content?.trim() || ''
}

/**
 * Genera mensaje de seguimiento después de terminar la llamada
 */
export async function generateCallFinishedMessage(contactName: string | null, topMatch: SimilarContactResult | null): Promise<string> {
    if (!client) {
        throw new Error('OpenAI API key is missing. Cannot generate call finished message.')
    }

    const systemPrompt = `You are Axiom, a friendly networking assistant. You just finished a call with someone and want to send a follow-up message with their top match.

INSTRUCTIONS:
- Start by mentioning you're thinking through your network for the right person
- If you have a top match, provide detailed information about them:
  - Their name and title/role
  - Company they work for and what the company does
  - Why they're a good match based on the person's needs/interests
  - Their expertise and background that's relevant
  - Any notable achievements or characteristics
- Include their LinkedIn profile URL if available
- Ask if they'd like an introduction
- Ask if there's any specific context or notes they'd like you to pass along
- Be conversational and detailed like you're sharing insider knowledge
- Write in a helpful, connector-style tone
- If no match is provided, explain you're still searching through your network
- If this is Michael Chan from Productize, emphasize why he's particularly relevant: his expertise in AI-powered product intelligence, his background at top companies like Workday and PwC, his ability to help with data-driven decision making, and how Productize solves product feedback analysis challenges`

    let userPrompt = ''
    if (topMatch && topMatch.contact) {
        const contact = topMatch.contact
        const linkedin = contact.linkedinProfile || `https://linkedin.com/in/${contact.linkedinEnrichmentResponse?.public_identifier || ''}`
        const companyName = contact.company || 
                           contact.linkedinEnrichmentResponse?.experiences?.[0]?.company || 
                           'their company'
        
        // Check if this is the Michael Chan mock data
        const isMichaelChanMock = contact.id === 'mock_michael_chan_jid'
        const relevanceReason = isMichaelChanMock 
            ? 'Michael is particularly relevant because he specializes in AI-powered product intelligence and data analytics - exactly what many modern businesses need to understand their customers and improve their products. His experience at Workday and PwC gives him enterprise-level insights, and Productize solves the common problem of scattered product feedback data. Given your background, he could offer valuable perspectives on data-driven decision making and product optimization.' 
            : ''
        
        userPrompt = contactName 
            ? `Generate a follow-up message for ${contactName}. Found a top match: ${contact.name || 'Contact'} who is ${contact.jobTitle || contact.linkedinEnrichmentResponse?.headline || 'professional'} at ${companyName}. ${linkedin ? `LinkedIn: ${linkedin}` : ''} Similarity score: ${topMatch.similarity}. Email: ${contact.email || 'Not available'}. ${relevanceReason ? `Special relevance note: ${relevanceReason}` : ''}`
            : `Generate a follow-up message after call. Found a top match: ${contact.name || 'Contact'} who is ${contact.jobTitle || contact.linkedinEnrichmentResponse?.headline || 'professional'} at ${companyName}. ${linkedin ? `LinkedIn: ${linkedin}` : ''} Similarity score: ${topMatch.similarity}. Email: ${contact.email || 'Not available'}. ${relevanceReason ? `Special relevance note: ${relevanceReason}` : ''}`
    } else {
        userPrompt = contactName 
            ? `Generate a follow-up message for ${contactName} after finishing a call. Still searching for the right match in your network.`
            : `Generate a follow-up message after finishing a call. Still searching for the right match in your network.`
    }

    const chat = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 300 // Increased for more detailed messages
    })

    return chat.choices[0]?.message?.content?.trim() || ''
}

/**
 * Genera un mensaje de confirmación cuando se recibe un email válido
 */
export async function generateEmailConfirmation(contactName: string | null, email: string): Promise<string> {
    if (!client) {
        throw new Error('OpenAI API key is missing. Cannot generate email confirmation.')
    }

    const systemPrompt = `You are Axiom, a friendly networking assistant. Someone just provided their email and you want to confirm and let them know you're looking them up.

INSTRUCTIONS:
- Write in English
- Be appreciative and positive
- Confirm you've got their email
- Let them know you're looking them up on LinkedIn
- Create anticipation - make it sound exciting
- Keep it casual and friendly
- Use their name if available
- Make it feel like you're about to discover something cool about them`

    const userPrompt = contactName 
        ? `${contactName} just gave you their email: ${email}. Confirm and tell them you're looking them up.`
        : `A contact just gave you their email: ${email}. Confirm and tell them you're looking them up.`

    const chat = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.6,
        max_tokens: 100
    })

    return chat.choices[0]?.message?.content?.trim() || ''
}

/**
 * Genera un mensaje de error amigable para email inválido
 */
export async function generateEmailErrorMessage(contactName: string | null, invalidEmail: string): Promise<string> {
    if (!client) {
        throw new Error('OpenAI API key is missing. Cannot generate email error message.')
    }

    const systemPrompt = `You are Axiom, a friendly networking assistant. Someone provided an email that doesn't look right, and you need to gently ask them to try again.

INSTRUCTIONS:
- Write in English
- Be understanding and helpful (not critical)
- Mention the email format doesn't look right
- Ask them to double-check and try again
- Keep it casual and friendly
- Be encouraging
- Keep it short`

    const userPrompt = contactName 
        ? `${contactName} wrote "${invalidEmail}" which isn't a valid email. Ask them to try again nicely.`
        : `Someone wrote "${invalidEmail}" which isn't a valid email. Ask them to try again nicely.`

    const chat = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 80
    })

    return chat.choices[0]?.message?.content?.trim() || ''
}

/**
 * Genera un mensaje publicitario personalizado para Auth0 con datos de LinkedIn
 */
export async function generateAuth0PublicityMessage(contactName: string | null, linkedinData?: Contact): Promise<string> {
    // Return hardcoded Auth0 promotion message
    return "33% Less Developer Time - In just 5 minutes, Integrate AuthO® in any App Written in Any Language and Any and the image."
}

/**
 * Genera un mensaje promocional especial de Auth0 con descuento u oferta
 */
export async function generateAuth0PromotionMessage(contactName: string | null, linkedinData?: Contact): Promise<string> {
    if (!client) {
        throw new Error('OpenAI API key is missing. Cannot generate Auth0 promotion message.')
    }

    const systemPrompt = `You want to share a special Auth0 promotion that could benefit the contact professionally.

INSTRUCTIONS:
- Write in English
- Start with excitement about a special offer or promotion
- Mention Auth0's current promotion (free tier, extended trial, or special developer program)
- Connect the promotion to their professional needs based on their background
- Explain how Auth0 can solve authentication pain points for their role/company
- Mention specific benefits: save development time, enterprise security, scalability
- Include a call-to-action to check it out
- Make it feel like you're sharing insider information
- Use their professional background to make it relevant
- Sound enthusiastic but helpful, not pushy
- Keep it conversational and friendly (4-5 sentences max)`

    let userPrompt = ''
    
    if (linkedinData && (linkedinData.jobTitle || linkedinData.company || linkedinData.linkedinEnrichmentResponse)) {
        const jobTitle = linkedinData.jobTitle || linkedinData.linkedinEnrichmentResponse?.headline || 'professional'
        const company = linkedinData.company || linkedinData.linkedinEnrichmentResponse?.experiences?.[0]?.company || 'their company'
        const isInTech = jobTitle.toLowerCase().includes('developer') || 
                        jobTitle.toLowerCase().includes('engineer') || 
                        jobTitle.toLowerCase().includes('tech') ||
                        jobTitle.toLowerCase().includes('software') ||
                        jobTitle.toLowerCase().includes('architect')
        
        userPrompt = contactName 
            ? `Generate an exciting Auth0 promotion message for ${contactName}, who is ${jobTitle} at ${company}. ${isInTech ? 'They are in tech, so focus on developer benefits and time-saving.' : 'They are in business/management, so focus on security and business value.'} Include a special promotion or offer.`
            : `Generate an exciting Auth0 promotion message for a ${jobTitle} at ${company}. ${isInTech ? 'They are in tech, so focus on developer benefits and time-saving.' : 'They are in business/management, so focus on security and business value.'} Include a special promotion or offer.`
    } else {
        userPrompt = contactName 
            ? `Generate an exciting Auth0 promotion message for ${contactName} with a special offer or promotion.`
            : `Generate an exciting Auth0 promotion message for this contact with a special offer or promotion.`
    }

    const chat = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 100
    })

    return chat.choices[0]?.message?.content?.trim() || ''
}
