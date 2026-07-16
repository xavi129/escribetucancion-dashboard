/**
 * WhatsApp Business API Client
 * 
 * Direct integration with Meta's WhatsApp Business Cloud API.
 * No intermediaries like SendPulse.
 */

const GRAPH_API_VERSION = 'v22.0'
const GRAPH_API_BASE = 'https://graph.facebook.com'

// ============================================
// Configuration
// ============================================

interface WhatsAppConfig {
  accessToken: string
  phoneNumberId: string
  businessAccountId?: string
}

function getConfig(): WhatsAppConfig {
  // Support both naming conventions
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_META_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_META_PHONE_NUMBER_ID
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID

  if (!accessToken || !phoneNumberId) {
    throw new Error(
      'Missing WhatsApp Business API configuration. Required: WHATSAPP_ACCESS_TOKEN or WHATSAPP_META_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_META_PHONE_NUMBER_ID'
    )
  }

  return { accessToken, phoneNumberId, businessAccountId }
}

/**
 * Validate that WhatsApp Business API is configured
 */
export function validateWhatsAppConfig(): void {
  getConfig() // Will throw if not configured
}

/**
 * Build the API endpoint URL
 */
export function buildApiUrl(phoneNumberId: string, endpoint: string = 'messages'): string {
  return `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${phoneNumberId}/${endpoint}`
}

// ============================================
// Types
// ============================================

export interface SendMessageResponse {
  success: boolean
  wamid?: string
  error?: string
}

export interface TextContent {
  body: string
  preview_url?: boolean
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button'
  parameters: Array<{
    type: 'text' | 'image' | 'document' | 'video'
    text?: string
    image?: { link: string }
  }>
}

export interface TemplateContent {
  name: string
  language: { code: string }
  components?: TemplateComponent[]
}

export interface MediaContent {
  link: string
  caption?: string
}

export interface CreateTemplateResponse {
  success: boolean
  id?: string
  status?: string
  category?: string
  error?: string
}

export type MessageTemplateCategory = 'AUTHENTICATION' | 'MARKETING' | 'UTILITY'

// ============================================
// Reaction & Read Receipt Functions
// ============================================

/**
 * Send a reaction emoji to a message
 * @param to - Phone number
 * @param messageId - The wamid of the message to react to
 * @param emoji - The emoji to react with (e.g., "👍", "❤️", "😂")
 */
export async function sendReaction(
  to: string,
  messageId: string,
  emoji: string
): Promise<SendMessageResponse> {
  const config = getConfig()
  const url = buildApiUrl(config.phoneNumberId)

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizePhoneNumber(to),
    type: 'reaction',
    reaction: {
      message_id: messageId,
      emoji: emoji,
    },
  }

  return sendRequest(url, payload, config.accessToken)
}

/**
 * Remove a reaction from a message
 * @param to - Phone number
 * @param messageId - The wamid of the message to remove reaction from
 */
export async function removeReaction(
  to: string,
  messageId: string
): Promise<SendMessageResponse> {
  const config = getConfig()
  const url = buildApiUrl(config.phoneNumberId)

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizePhoneNumber(to),
    type: 'reaction',
    reaction: {
      message_id: messageId,
      emoji: '', // Empty string removes the reaction
    },
  }

  return sendRequest(url, payload, config.accessToken)
}

/**
 * Mark a message as read (shows blue checkmarks to the user)
 * @param messageId - The wamid of the message to mark as read
 */
export async function markAsRead(messageId: string): Promise<SendMessageResponse> {
  const config = getConfig()
  const url = buildApiUrl(config.phoneNumberId)

  const payload = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  }

  return sendRequest(url, payload, config.accessToken)
}

// ============================================
// Interactive Message Types
// ============================================

export interface InteractiveButton {
  type: 'reply'
  reply: {
    id: string
    title: string // Max 20 characters
  }
}

export interface InteractiveListRow {
  id: string
  title: string // Max 24 characters
  description?: string // Max 72 characters
}

export interface InteractiveListSection {
  title?: string // Max 24 characters
  rows: InteractiveListRow[]
}

export interface InteractiveButtonMessage {
  type: 'button'
  header?: {
    type: 'text' | 'image' | 'video' | 'document'
    text?: string
    image?: { link: string }
    video?: { link: string }
    document?: { link: string; filename: string }
  }
  body: {
    text: string // Max 1024 characters
  }
  footer?: {
    text: string // Max 60 characters
  }
  action: {
    buttons: InteractiveButton[] // Max 3 buttons
  }
}

export interface InteractiveListMessage {
  type: 'list'
  header?: {
    type: 'text'
    text: string
  }
  body: {
    text: string
  }
  footer?: {
    text: string
  }
  action: {
    button: string // Max 20 characters - button text to open list
    sections: InteractiveListSection[] // Max 10 sections, 10 rows each
  }
}

export interface InteractiveCTAMessage {
  type: 'cta_url'
  header?: {
    type: 'text'
    text: string
  }
  body: {
    text: string
  }
  footer?: {
    text: string
  }
  action: {
    name: 'cta_url'
    parameters: {
      display_text: string
      url: string
    }
  }
}

// ============================================
// Send Message Functions
// ============================================

/**
 * Send a text message
 */
export async function sendTextMessage(
  to: string,
  body: string
): Promise<SendMessageResponse> {
  const config = getConfig()
  const url = buildApiUrl(config.phoneNumberId)

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizePhoneNumber(to),
    type: 'text',
    text: {
      preview_url: false,
      body: body,
    },
  }

  return sendRequest(url, payload, config.accessToken)
}

/**
 * Send a template message
 */
export async function sendTemplateMessage(
  to: string,
  template: TemplateContent
): Promise<SendMessageResponse> {
  const config = getConfig()
  const url = buildApiUrl(config.phoneNumberId)

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizePhoneNumber(to),
    type: 'template',
    template: {
      name: template.name,
      language: template.language,
      components: template.components || [],
    },
  }

  return sendRequest(url, payload, config.accessToken)
}

/**
 * Create a WhatsApp message template in the Meta Business account.
 */
export async function createMessageTemplate(
  name: string,
  category: MessageTemplateCategory,
  bodyText: string,
  language = 'es_MX'
): Promise<CreateTemplateResponse> {
  const config = getConfig()

  if (!config.businessAccountId) {
    throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID is required')
  }

  const payload = {
    name,
    category,
    allow_category_change: true,
    language,
    components: [
      {
        type: 'BODY',
        text: bodyText,
      },
    ],
  }

  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${config.businessAccountId}/message_templates`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    )

    const responseText = await response.text()

    if (!response.ok) {
      let errorMessage = `${response.status}: ${responseText}`

      try {
        const errorData = JSON.parse(responseText)
        if (errorData.error?.message) {
          errorMessage = errorData.error.message
        }
      } catch {
        // Use raw response text
      }

      return { success: false, error: errorMessage }
    }

    const data = JSON.parse(responseText) as {
      id?: string
      status?: string
      category?: string
    }

    return {
      success: true,
      id: data.id,
      status: data.status,
      category: data.category,
    }
  } catch (error) {
    console.error('[WhatsApp API] Error creating template:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Send an audio message
 */
export async function sendAudioMessage(
  to: string,
  audioUrl: string,
  caption?: string
): Promise<SendMessageResponse> {
  const config = getConfig()
  const url = buildApiUrl(config.phoneNumberId)

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizePhoneNumber(to),
    type: 'audio',
    audio: {
      link: audioUrl,
    },
  }

  return sendRequest(url, payload, config.accessToken)
}

/**
 * Send an image message
 */
export async function sendImageMessage(
  to: string,
  imageUrl: string,
  caption?: string
): Promise<SendMessageResponse> {
  const config = getConfig()
  const url = buildApiUrl(config.phoneNumberId)

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizePhoneNumber(to),
    type: 'image',
    image: {
      link: imageUrl,
      caption: caption,
    },
  }

  return sendRequest(url, payload, config.accessToken)
}

/**
 * Send a document message
 */
export async function sendDocumentMessage(
  to: string,
  documentUrl: string,
  filename: string,
  caption?: string
): Promise<SendMessageResponse> {
  const config = getConfig()
  const url = buildApiUrl(config.phoneNumberId)

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizePhoneNumber(to),
    type: 'document',
    document: {
      link: documentUrl,
      filename: filename,
      caption: caption,
    },
  }

  return sendRequest(url, payload, config.accessToken)
}

// ============================================
// Interactive Message Functions
// ============================================

/**
 * Send an interactive button message (max 3 buttons)
 */
export async function sendButtonMessage(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
  options?: {
    header?: string
    footer?: string
    headerImage?: string
  }
): Promise<SendMessageResponse> {
  const config = getConfig()
  const url = buildApiUrl(config.phoneNumberId)

  const interactive: InteractiveButtonMessage = {
    type: 'button',
    body: { text: body },
    action: {
      buttons: buttons.slice(0, 3).map(btn => ({
        type: 'reply' as const,
        reply: {
          id: btn.id,
          title: btn.title.slice(0, 20), // Max 20 chars
        },
      })),
    },
  }

  if (options?.header) {
    interactive.header = { type: 'text', text: options.header }
  } else if (options?.headerImage) {
    interactive.header = { type: 'image', image: { link: options.headerImage } }
  }

  if (options?.footer) {
    interactive.footer = { text: options.footer.slice(0, 60) }
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizePhoneNumber(to),
    type: 'interactive',
    interactive,
  }

  return sendRequest(url, payload, config.accessToken)
}

/**
 * Send an interactive list message
 */
export async function sendListMessage(
  to: string,
  body: string,
  buttonText: string,
  sections: Array<{
    title?: string
    rows: Array<{ id: string; title: string; description?: string }>
  }>,
  options?: {
    header?: string
    footer?: string
  }
): Promise<SendMessageResponse> {
  const config = getConfig()
  const url = buildApiUrl(config.phoneNumberId)

  const interactive: InteractiveListMessage = {
    type: 'list',
    body: { text: body },
    action: {
      button: buttonText.slice(0, 20),
      sections: sections.map(section => ({
        title: section.title?.slice(0, 24),
        rows: section.rows.slice(0, 10).map(row => ({
          id: row.id,
          title: row.title.slice(0, 24),
          description: row.description?.slice(0, 72),
        })),
      })),
    },
  }

  if (options?.header) {
    interactive.header = { type: 'text', text: options.header }
  }

  if (options?.footer) {
    interactive.footer = { text: options.footer.slice(0, 60) }
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizePhoneNumber(to),
    type: 'interactive',
    interactive,
  }

  return sendRequest(url, payload, config.accessToken)
}

/**
 * Send a CTA URL button message (single button that opens a URL)
 */
export async function sendCTAMessage(
  to: string,
  body: string,
  buttonText: string,
  url: string,
  options?: {
    header?: string
    footer?: string
  }
): Promise<SendMessageResponse> {
  const config = getConfig()
  const apiUrl = buildApiUrl(config.phoneNumberId)

  const interactive: InteractiveCTAMessage = {
    type: 'cta_url',
    body: { text: body },
    action: {
      name: 'cta_url',
      parameters: {
        display_text: buttonText.slice(0, 20), // Max 20 chars
        url: url,
      },
    },
  }

  if (options?.header) {
    interactive.header = { type: 'text', text: options.header }
  }

  if (options?.footer) {
    interactive.footer = { text: options.footer.slice(0, 60) }
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizePhoneNumber(to),
    type: 'interactive',
    interactive,
  }

  return sendRequest(apiUrl, payload, config.accessToken)
}

// ============================================
// Pre-built Business Messages
// ============================================

/**
 * Send song confirmation with buttons
 */
export async function sendSongConfirmation(
  to: string,
  songUrl: string,
  customerName: string
): Promise<SendMessageResponse> {
  return sendButtonMessage(
    to,
    `🎵 ¡Hola ${customerName}!\n\nTu canción está lista. Escúchala y dinos qué te parece.\n\n¿Te gusta como quedó?`,
    [
      { id: 'confirm_song', title: '✅ Me encanta' },
      { id: 'request_changes', title: '✏️ Quiero cambios' },
      { id: 'listen_again', title: '🎧 Escuchar de nuevo' },
    ],
    {
      header: '🎁 Tu Canción Personalizada',
      footer: 'EscribeTuCancion.com',
    }
  )
}

/**
 * Send payment reminder with CTA button
 */
export async function sendPaymentReminder(
  to: string,
  customerName: string,
  amount: number,
  paymentUrl: string
): Promise<SendMessageResponse> {
  return sendCTAMessage(
    to,
    `💳 Hola ${customerName},\n\nTu pedido está pendiente de pago.\n\n💰 Total: $${amount} MXN\n\nHaz clic en el botón para completar tu pago de forma segura.`,
    'Pagar ahora',
    paymentUrl,
    {
      header: '⏰ Recordatorio de Pago',
      footer: 'EscribeTuCancion.com',
    }
  )
}

/**
 * Send lyric approval instructions (text-based for better UX)
 * Using text instead of buttons so user can add details when requesting changes
 */
export async function sendLyricApproval(
  to: string,
  customerName: string,
  _lyricPreview: string
): Promise<SendMessageResponse> {
  // Send text message with instructions instead of buttons
  // This allows user to write their change requests directly
  return sendTextMessage(
    to,
    `Para continuar, responde:\n\n✅ Escribe *"confirmo letra"* si te gusta y quieres continuar\n\n✏️ Escribe *"editar letra"* seguido de lo que quieres cambiar\n\n_Ejemplo: "editar letra quiero que sea más alegre y mencione que nos conocimos en la playa"_`
  )
}

/**
 * Send lyric approval with single confirm button
 * For cases where we just need confirmation
 */
export async function sendLyricConfirmButton(
  to: string,
  customerName: string
): Promise<SendMessageResponse> {
  return sendButtonMessage(
    to,
    `✨ ¿Te gusta la letra?\n\nSi quieres hacer cambios, escríbenos qué te gustaría modificar.`,
    [
      { id: 'approve_lyric', title: '✅ Confirmar letra' },
    ],
    {
      footer: 'EscribeTuCancion.com',
    }
  )
}

/**
 * Send delivery options list
 */
export async function sendDeliveryOptions(
  to: string,
  customerName: string,
  standardPrice: number,
  expressPrice: number
): Promise<SendMessageResponse> {
  return sendListMessage(
    to,
    `🚀 ¡Hola ${customerName}!\n\n¿Te gustaría recibir tu canción más rápido?\n\nElige tu opción de entrega:`,
    'Ver opciones',
    [
      {
        title: 'Opciones de Entrega',
        rows: [
          {
            id: 'delivery_standard',
            title: '📦 Estándar (3-5 días)',
            description: `$${standardPrice} MXN - Sin costo adicional`,
          },
          {
            id: 'delivery_express',
            title: '⚡ Express (24 horas)',
            description: `+$${expressPrice} MXN - Entrega prioritaria`,
          },
        ],
      },
    ],
    {
      header: '🎵 Opciones de Entrega',
      footer: 'EscribeTuCancion.com',
    }
  )
}

/**
 * Send song with play button
 */
export async function sendSongWithPlayer(
  to: string,
  customerName: string,
  playUrl: string
): Promise<SendMessageResponse> {
  return sendCTAMessage(
    to,
    `🎵 ¡${customerName}, tu canción está lista!\n\n🎧 Haz clic en el botón para escucharla en nuestro reproductor especial.\n\n¡Esperamos que te encante! 💖`,
    '▶️ Escuchar',
    playUrl,
    {
      header: '🎁 ¡Tu Canción Lista!',
      footer: 'EscribeTuCancion.com',
    }
  )
}

// ============================================
// Media Functions
// ============================================

/**
 * Download media from WhatsApp
 */
export async function downloadMedia(mediaId: string): Promise<Buffer> {
  const config = getConfig()
  
  // First, get the media URL
  const mediaInfoUrl = `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${mediaId}`
  
  const infoResponse = await fetch(mediaInfoUrl, {
    headers: {
      'Authorization': `Bearer ${config.accessToken}`,
    },
  })

  if (!infoResponse.ok) {
    throw new Error(`Failed to get media info: ${infoResponse.status}`)
  }

  const mediaInfo = await infoResponse.json() as { url: string }
  
  // Then download the actual media
  const mediaResponse = await fetch(mediaInfo.url, {
    headers: {
      'Authorization': `Bearer ${config.accessToken}`,
    },
  })

  if (!mediaResponse.ok) {
    throw new Error(`Failed to download media: ${mediaResponse.status}`)
  }

  const arrayBuffer = await mediaResponse.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Get media URL (for proxying)
 */
export async function getMediaUrl(mediaId: string): Promise<string> {
  const config = getConfig()
  
  const mediaInfoUrl = `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${mediaId}`
  
  const response = await fetch(mediaInfoUrl, {
    headers: {
      'Authorization': `Bearer ${config.accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to get media URL: ${response.status}`)
  }

  const data = await response.json() as { url: string }
  return data.url
}

// ============================================
// Webhook Validation
// ============================================

/**
 * Validate webhook signature using HMAC-SHA256
 */
export async function validateWebhookSignature(
  payload: string,
  signature: string,
  appSecret: string
): Promise<boolean> {
  if (!signature || !appSecret) return false

  const expectedPrefix = 'sha256='
  if (!signature.startsWith(expectedPrefix)) return false

  const providedHash = signature.slice(expectedPrefix.length)

  // Use Web Crypto API for HMAC-SHA256
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  )

  const computedHash = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return computedHash === providedHash
}

// ============================================
// Helper Functions
// ============================================

/**
 * Normalize phone number to WhatsApp format
 * For Mexico: removes the extra "1" after country code if present
 * WhatsApp expects: 52 + 10 digits (e.g., 526161208649)
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-numeric characters except +
  let cleaned = phone.replace(/[^\d+]/g, '')
  
  // Remove leading + if present (WhatsApp API doesn't want it)
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1)
  }
  
  // If it's a Mexican number without country code, add 52
  if (cleaned.length === 10 && !cleaned.startsWith('52')) {
    cleaned = '52' + cleaned
  }
  
  // Fix Mexican numbers: remove the extra "1" after 52 if present
  // Wrong: 5216161208649 (13 digits) -> Correct: 526161208649 (12 digits)
  if (cleaned.startsWith('521') && cleaned.length === 13) {
    cleaned = '52' + cleaned.slice(3)
  }
  
  return cleaned
}

/**
 * Send a request to the WhatsApp API
 */
async function sendRequest(
  url: string,
  payload: Record<string, unknown>,
  accessToken: string
): Promise<SendMessageResponse> {
  try {
    console.log('[WhatsApp API] Sending to:', url)
    console.log('[WhatsApp API] Payload:', JSON.stringify(payload, null, 2))

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()
    console.log('[WhatsApp API] Response:', response.status, responseText)

    if (!response.ok) {
      let errorMessage = `${response.status}: ${responseText}`
      
      try {
        const errorData = JSON.parse(responseText)
        if (errorData.error?.message) {
          errorMessage = errorData.error.message
        }
      } catch {
        // Use raw response text
      }

      return { success: false, error: errorMessage }
    }

    const data = JSON.parse(responseText) as {
      messages?: Array<{ id: string }>
    }

    const wamid = data.messages?.[0]?.id

    return { success: true, wamid }
  } catch (error) {
    console.error('[WhatsApp API] Error:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Format message with branding (optional)
 */
export function formatBrandedMessage(text: string): string {
  if (!text.includes('🎵') && !text.includes('🎁') && !text.includes('💖')) {
    return `🎵 ${text} 💖`
  }
  return text
}
