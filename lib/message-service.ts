/**
 * Message Service
 * 
 * Business logic for managing messages.
 */

import {
  getMessages as d1GetMessages,
  createMessage as d1CreateMessage,
  updateMessageStatus as d1UpdateStatus,
  d1Query,
  type Message,
} from './d1-client'
import { sendTextMessage, sendTemplateMessage, sendAudioMessage } from './whatsapp-business'
import { getConversationByPhone, createConversation, autoLinkToOrder } from './conversation-service'

// ============================================
// Types
// ============================================

/**
 * Result type for message operations
 */
export interface MessageResult {
  success: boolean
  messageId?: string
  error?: string
  warning?: string
}

// ============================================
// Message Operations
// ============================================

/**
 * Get messages for a conversation ordered by timestamp
 */
export async function getMessages(conversationId: string): Promise<Message[]> {
  return d1GetMessages(conversationId)
}

/**
 * Create a new message
 */
export async function createMessage(data: {
  conversation_id: string
  wamid?: string | null
  direction: 'incoming' | 'outgoing'
  type: string
  content: string
  media_url?: string | null
  status: string
  source?: 'operator' | 'agent' | 'system'
}): Promise<Message> {
  return d1CreateMessage(data)
}

/**
 * Update message status
 */
export async function updateMessageStatus(wamid: string, status: string): Promise<void> {
  await d1UpdateStatus(wamid, status)
}

/**
 * Send a text message and store it
 */
export async function sendAndStoreTextMessage(
  phoneNumber: string,
  content: string,
  source: 'operator' | 'agent' | 'system' = 'operator'
): Promise<MessageResult> {
  // Find or create conversation
  let conversation = await getConversationByPhone(phoneNumber)
  if (!conversation) {
    conversation = await createConversation(phoneNumber)
    await autoLinkToOrder(phoneNumber)
  }

  // Send via WhatsApp API
  const result = await sendTextMessage(phoneNumber, content)
  
  if (!result.success) {
    return { success: false, error: result.error }
  }

  // Store message - handle persistence errors separately
  try {
    const message = await createMessage({
      conversation_id: conversation.id,
      wamid: result.wamid || null,
      direction: 'outgoing',
      type: 'text',
      content,
      status: 'sent',
      source,
    })

    return { success: true, messageId: message.id }
  } catch (persistenceError) {
    console.error('[Message Service] Text message sent successfully but failed to save to database:', {
      wamid: result.wamid,
      conversationId: conversation.id,
      error: persistenceError
    })
    
    // Return success since WhatsApp message was sent
    return { 
      success: true, 
      warning: 'Message sent but not saved to database'
    }
  }
}

/**
 * Send an audio message and store it
 */
export async function sendAndStoreAudioMessage(
  phoneNumber: string,
  audioUrl: string,
  source: 'operator' | 'agent' | 'system' = 'operator'
): Promise<MessageResult> {
  // Find or create conversation
  let conversation = await getConversationByPhone(phoneNumber)
  if (!conversation) {
    conversation = await createConversation(phoneNumber)
    await autoLinkToOrder(phoneNumber)
  }

  // Send via WhatsApp API
  const result = await sendAudioMessage(phoneNumber, audioUrl)
  
  if (!result.success) {
    return { success: false, error: result.error }
  }

  // Store message - handle persistence errors separately
  try {
    const message = await createMessage({
      conversation_id: conversation.id,
      wamid: result.wamid || null,
      direction: 'outgoing',
      type: 'audio',
      content: '[Audio]',
      media_url: audioUrl,
      status: 'sent',
      source,
    })

    return { success: true, messageId: message.id }
  } catch (persistenceError) {
    console.error('[Message Service] Audio message sent successfully but failed to save to database:', {
      wamid: result.wamid,
      conversationId: conversation.id,
      error: persistenceError
    })
    
    // Return success since WhatsApp message was sent
    return { 
      success: true, 
      warning: 'Message sent but not saved to database'
    }
  }
}

/**
 * Process an incoming message from webhook
 */
export async function processIncomingMessage(data: {
  phoneNumber: string
  wamid: string
  type: string
  content: string
  mediaUrl?: string | null
  customerName?: string | null
}): Promise<Message> {
  // Find or create conversation
  let conversation = await getConversationByPhone(data.phoneNumber)
  
  if (!conversation) {
    conversation = await createConversation(data.phoneNumber, data.customerName || undefined)
  }

  // Update conversation
  await d1Query(
    `UPDATE conversations 
     SET last_message = ?, 
         last_message_at = datetime('now'),
         last_incoming_at = datetime('now'),
         unread_count = unread_count + 1,
         updated_at = datetime('now')
     WHERE id = ?`,
    [data.content, conversation.id]
  )

  // Update customer name if provided
  if (data.customerName && !conversation.customer_name) {
    await d1Query(
      'UPDATE conversations SET customer_name = ? WHERE id = ?',
      [data.customerName, conversation.id]
    )
  }

  // Store message
  const message = await createMessage({
    conversation_id: conversation.id,
    wamid: data.wamid,
    direction: 'incoming',
    type: data.type,
    content: data.content,
    media_url: data.mediaUrl || null,
    status: 'delivered',
    source: 'system',
  })

  return message
}

/**
 * Get recent messages for context (for agent notifications)
 */
export async function getRecentMessages(
  conversationId: string,
  limit: number = 5
): Promise<Message[]> {
  const result = await d1Query<Message>(
    `SELECT * FROM messages 
     WHERE conversation_id = ? 
     ORDER BY created_at DESC 
     LIMIT ?`,
    [conversationId, limit]
  )
  
  return result.results.reverse() // Return in chronological order
}
