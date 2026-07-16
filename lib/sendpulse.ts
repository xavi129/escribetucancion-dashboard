/**
 * SendPulse WhatsApp API Integration
 * 
 * This module provides functions to interact with SendPulse WhatsApp Business API
 * including OAuth2 authentication, sending messages, and parsing webhooks.
 */

import { formatPhoneNumberForWhatsApp } from './phone-utils'

// Token cache to avoid unnecessary authentication requests
let cachedToken: {
  access_token: string
  expires_at: number
} | null = null

/**
 * Get an OAuth2 access token from SendPulse
 * Tokens are cached for 55 minutes (5 min margin before expiration)
 */
export async function getSendPulseToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expires_at > Date.now()) {
    console.log('[SendPulse] Using cached token')
    return cachedToken.access_token
  }

  const clientId = process.env.SENDPULSE_CLIENT_ID
  const clientSecret = process.env.SENDPULSE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('SendPulse credentials not configured (SENDPULSE_CLIENT_ID, SENDPULSE_CLIENT_SECRET)')
  }

  console.log('[SendPulse] Requesting new access token...')

  const response = await fetch('https://api.sendpulse.com/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  const responseText = await response.text()

  if (!response.ok) {
    console.error('[SendPulse] Token request failed:', response.status, responseText)
    throw new Error(`Failed to get SendPulse token: ${response.status} ${responseText}`)
  }

  let data
  try {
    data = JSON.parse(responseText)
  } catch (parseError) {
    console.error('[SendPulse] Failed to parse token response:', responseText)
    throw new Error(`Invalid JSON response from SendPulse: ${responseText.substring(0, 100)}`)
  }

  // Cache token with 5 min margin before expiration
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 300) * 1000,
  }

  console.log('[SendPulse] Token obtained, valid for', data.expires_in, 'seconds')

  return cachedToken.access_token
}

/**
 * Send a WhatsApp message via SendPulse API
 * 
 * @param phoneNumber - Phone number with country code (e.g., "+526161208649")
 * @param messageBody - Text message to send
 * @returns Object with success status and messageId or error
 */
export async function sendSendPulseMessage(
  phoneNumber: string,
  messageBody: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const token = await getSendPulseToken()
    const botId = process.env.SENDPULSE_BOT_ID

    if (!botId) {
      throw new Error('SENDPULSE_BOT_ID not configured')
    }

    // Clean phone number - SendPulse doesn't want the + prefix
    const formattedPhone = formatPhoneNumberForWhatsApp(phoneNumber)
    const cleanPhone = formattedPhone.replace(/^\+/, '')

    console.log('[SendPulse] Sending message to', cleanPhone)

    const response = await fetch(
      'https://api.sendpulse.com/whatsapp/contacts/sendByPhone',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          bot_id: botId,
          phone: cleanPhone,
          message: {
            type: 'text',
            text: {
              body: messageBody,
            },
          },
        }),
      }
    )

    const responseText = await response.text()

    if (!response.ok) {
      console.error('[SendPulse] Send failed:', response.status, responseText)
      return { success: false, error: `${response.status}: ${responseText}` }
    }

    let result
    try {
      result = JSON.parse(responseText)
    } catch (parseError) {
      console.error('[SendPulse] Failed to parse send response:', responseText)
      return { success: false, error: `Invalid JSON response: ${responseText.substring(0, 100)}` }
    }

    if (!result.success && result.error) {
      console.error('[SendPulse] API error:', result.error)
      return { success: false, error: result.error }
    }

    console.log('[SendPulse] Message sent successfully to', cleanPhone, { messageId: result.data?.id })

    return { success: true, messageId: result.data?.id }
  } catch (error) {
    console.error('[SendPulse] Send error:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Format message with MelodiaMia/EscribeTuCanción branding
 * Adds emojis if not present
 */
export function formatBrandedMessage(text: string): string {
  // Add emojis if not already present
  if (!text.includes('🎵') && !text.includes('🎁') && !text.includes('💖')) {
    return `🎵 ${text} 💖`
  }
  return text
}

/**
 * Send a reply with branding
 */
export async function sendBrandedReply(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const formatted = formatBrandedMessage(message)
  return sendSendPulseMessage(phoneNumber, formatted)
}

/**
 * Send an interactive button message via SendPulse API
 *
 * @param phoneNumber - Phone number with country code (e.g., "+526161208649")
 * @param bodyText - Text message body to display
 * @param buttons - Array of buttons (max 3) with id and title
 * @returns Object with success status and messageId or error
 */
export async function sendSendPulseInteractiveButtons(
  phoneNumber: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const token = await getSendPulseToken()
    const botId = process.env.SENDPULSE_BOT_ID

    if (!botId) {
      throw new Error('SENDPULSE_BOT_ID not configured')
    }

    // WhatsApp allows max 3 buttons
    if (buttons.length > 3) {
      throw new Error('WhatsApp allows maximum 3 buttons')
    }

    // Clean phone number - SendPulse doesn't want the + prefix
    const formattedPhone = formatPhoneNumberForWhatsApp(phoneNumber)
    const cleanPhone = formattedPhone.replace(/^\+/, '')

    console.log('[SendPulse] Sending interactive button message to', cleanPhone)

    // Build buttons array with correct SendPulse structure
    const buttonPayload = buttons.map(btn => ({
      type: 'reply',
      reply: {
        id: btn.id,
        title: btn.title.substring(0, 20) // WhatsApp limits button title to 20 chars
      }
    }))

    const response = await fetch(
      'https://api.sendpulse.com/whatsapp/contacts/sendByPhone',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          bot_id: botId,
          phone: cleanPhone,
          message: {
            type: 'interactive',
            interactive: {
              type: 'button',
              body: {
                text: bodyText
              },
              action: {
                buttons: buttonPayload
              }
            }
          }
        }),
      }
    )

    const responseText = await response.text()

    if (!response.ok) {
      console.error('[SendPulse] Interactive message send failed:', response.status, responseText)
      return { success: false, error: `${response.status}: ${responseText}` }
    }

    let result
    try {
      result = JSON.parse(responseText)
    } catch (parseError) {
      console.error('[SendPulse] Failed to parse interactive response:', responseText)
      return { success: false, error: `Invalid JSON response: ${responseText.substring(0, 100)}` }
    }

    if (!result.success && result.error) {
      console.error('[SendPulse] Interactive API error:', result.error)
      return { success: false, error: result.error }
    }

    console.log('[SendPulse] Interactive message sent successfully to', cleanPhone, { messageId: result.data?.id })

    return { success: true, messageId: result.data?.id }
  } catch (error) {
    console.error('[SendPulse] Interactive message send error:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Send an interactive message with a CTA URL button via SendPulse API
 * Note: WhatsApp API allows only one CTA URL button per interactive message
 *
 * @param phoneNumber - Phone number with country code (e.g., "+526161208649")
 * @param bodyText - Text message body to display
 * @param ctaButton - CTA button with title and URL
 * @returns Object with success status and messageId or error
 */
export async function sendSendPulseInteractiveWithCTA(
  phoneNumber: string,
  bodyText: string,
  ctaButton: { title: string; url: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const token = await getSendPulseToken()
    const botId = process.env.SENDPULSE_BOT_ID

    if (!botId) {
      throw new Error('SENDPULSE_BOT_ID not configured')
    }

    // Clean phone number - SendPulse doesn't want the + prefix
    const formattedPhone = formatPhoneNumberForWhatsApp(phoneNumber)
    const cleanPhone = formattedPhone.replace(/^\+/, '')

    console.log('[SendPulse] Sending interactive CTA message to', cleanPhone)

    // For CTA URL buttons, WhatsApp uses a different structure
    const response = await fetch(
      'https://api.sendpulse.com/whatsapp/contacts/sendByPhone',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          bot_id: botId,
          phone: cleanPhone,
          message: {
            type: 'interactive',
            interactive: {
              type: 'cta_url',
              body: {
                text: bodyText
              },
              action: {
                name: 'cta_url',
                parameters: {
                  display_text: ctaButton.title.substring(0, 20),
                  url: ctaButton.url
                }
              }
            }
          }
        }),
      }
    )

    const responseText = await response.text()

    if (!response.ok) {
      console.error('[SendPulse] CTA message send failed:', response.status, responseText)
      return { success: false, error: `${response.status}: ${responseText}` }
    }

    let result
    try {
      result = JSON.parse(responseText)
    } catch (parseError) {
      console.error('[SendPulse] Failed to parse CTA response:', responseText)
      return { success: false, error: `Invalid JSON response: ${responseText.substring(0, 100)}` }
    }

    if (!result.success && result.error) {
      console.error('[SendPulse] CTA API error:', result.error)
      return { success: false, error: result.error }
    }

    console.log('[SendPulse] CTA message sent successfully to', cleanPhone, { messageId: result.data?.id })

    return { success: true, messageId: result.data?.id }
  } catch (error) {
    console.error('[SendPulse] CTA message send error:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Verify that a webhook payload comes from our configured SendPulse bot
 * 
 * @param payload - The webhook payload from SendPulse
 * @returns true if the webhook is valid, false otherwise
 */
export function verifySendPulseWebhook(payload: any): boolean {
  const botId = process.env.SENDPULSE_BOT_ID

  if (!botId) {
    console.error('[SendPulse] SENDPULSE_BOT_ID not configured')
    return false
  }

  const event = Array.isArray(payload) ? payload[0] : payload
  const incomingBotId = event?.bot?.id

  if (!incomingBotId) {
    console.error('[SendPulse] No bot ID in webhook payload')
    return false
  }

  if (incomingBotId !== botId) {
    console.error('[SendPulse] Bot ID mismatch:', { expected: botId, received: incomingBotId })
    return false
  }

  console.log('[SendPulse] Webhook verified successfully')
  return true
}

/**
 * Parse a SendPulse webhook payload to extract phone number and message
 *
 * @param payload - The webhook payload from SendPulse
 * @returns Object with phoneNumber and messageBody, or null if invalid
 */
export function parseSendPulseWebhook(payload: any): {
  phoneNumber: string | null
  messageBody: string | null
} {
  const event = Array.isArray(payload) ? payload[0] : payload

  const phone = event?.contact?.phone
  const messageText =
    event?.info?.message?.channel_data?.message?.text?.body ||
    event?.contact?.last_message

  if (!phone || !messageText) {
    console.error('[SendPulse] Invalid webhook payload:', { phone, messageText })
    return { phoneNumber: null, messageBody: null }
  }

  // Normalize phone number (add + if not present)
  const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`

  console.log('[SendPulse] Parsed webhook:', { phone: normalizedPhone, message: messageText })

  return {
    phoneNumber: normalizedPhone,
    messageBody: messageText,
  }
}

/**
 * Send a WhatsApp template message via SendPulse API
 * 
 * @param phoneNumber - Phone number with country code (e.g., "+526161208649")
 * @param templateName - Name of the template to send
 * @param components - Template components with parameters
 * @returns Object with success status and messageId or error
 */
export async function sendSendPulseTemplate(
  phoneNumber: string,
  templateName: string,
  components: Array<{
    type: string
    sub_type?: string
    index?: number
    parameters: Array<{
      type: string
      text?: string
      payload?: string
    }>
  }> = [],
  languageCode: string = 'es_MX'
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const token = await getSendPulseToken()
    const botId = process.env.SENDPULSE_BOT_ID

    if (!botId) {
      throw new Error('SENDPULSE_BOT_ID not configured')
    }

    // Clean phone number - SendPulse doesn't want the + prefix
    const formattedPhone = formatPhoneNumberForWhatsApp(phoneNumber)
    const cleanPhone = formattedPhone.replace(/^\+/, '')

    const requestBody = {
      bot_id: botId,
      phone: cleanPhone,
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        components: components.length > 0 ? components : [],
      },
    }

    console.log('[SendPulse] Sending template', templateName, 'to', cleanPhone)
    console.log('[SendPulse] Request body:', JSON.stringify(requestBody, null, 2))

    const response = await fetch(
      'https://api.sendpulse.com/whatsapp/contacts/sendTemplateByPhone',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      }
    )

    const responseText = await response.text()

    if (!response.ok) {
      console.error('[SendPulse] Template send failed:', response.status, responseText)
      return { success: false, error: `${response.status}: ${responseText}` }
    }

    let result
    try {
      result = JSON.parse(responseText)
    } catch (parseError) {
      console.error('[SendPulse] Failed to parse template response:', responseText)
      return { success: false, error: `Invalid JSON response: ${responseText.substring(0, 100)}` }
    }

    // Verificar si hay errores en la respuesta
    if (!result.success) {
      const errorMessage = result.message || result.error || 'Unknown error'
      const errorCode = result.error_code || 'N/A'
      const errors = result.errors || {}
      
      console.error('[SendPulse] Template API error:', {
        success: result.success,
        message: errorMessage,
        error_code: errorCode,
        errors: errors,
        fullResponse: result
      })
      
      return { success: false, error: `${errorCode}: ${errorMessage} ${JSON.stringify(errors)}` }
    }

    console.log('[SendPulse] Template sent successfully to', cleanPhone, { messageId: result.data?.id })

    return { success: true, messageId: result.data?.id }
  } catch (error) {
    console.error('[SendPulse] Template send error:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Check if SendPulse is configured as the WhatsApp provider
 */
export function isSendPulseEnabled(): boolean {
  const provider = process.env.WHATSAPP_PROVIDER
  return provider === 'sendpulse'
}

/**
 * Validate SendPulse configuration
 * @throws Error if configuration is incomplete
 */
export function validateSendPulseConfig(): void {
  const required = ['SENDPULSE_CLIENT_ID', 'SENDPULSE_CLIENT_SECRET', 'SENDPULSE_BOT_ID']
  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    throw new Error(`Missing SendPulse configuration: ${missing.join(', ')}`)
  }
}
