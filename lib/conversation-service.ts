/**
 * Conversation Service
 * 
 * Business logic for managing conversations.
 * Handles cross-database operations between D1 and Supabase.
 */

import { 
  getConversations as d1GetConversations,
  getConversationByPhone as d1GetConversationByPhone,
  getConversationById as d1GetConversationById,
  markConversationAsRead as d1MarkAsRead,
  linkConversationToOrder as d1LinkToOrder,
  d1Query,
  type Conversation,
  type ConversationFilters,
} from './d1-client'
import { supabase } from './supabase'
import { type ConversationWithOrder } from './inbox-types'

// ============================================
// Conversation Operations
// ============================================

/**
 * Get all conversations with order data
 */
export async function getConversationsWithOrders(
  filters?: ConversationFilters
): Promise<ConversationWithOrder[]> {
  // Get conversations from D1
  const conversations = await d1GetConversations(filters)

  // Get order IDs
  const orderIds = conversations
    .map(c => c.order_id)
    .filter((id): id is string => id !== null)

  if (orderIds.length === 0) {
    return conversations.map(c => ({ ...c, order: null }))
  }

  // Fetch orders from Supabase
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, customer_name, status, payment_status, song_type, delivery_type, audio_url, generated_lyric, total_price, email, hyperfollow_url')
    .in('id', orderIds)

  if (error) {
    console.error('[ConversationService] Error fetching orders:', error)
    return conversations.map(c => ({ ...c, order: null }))
  }

  // Create order map
  const ordersMap = new Map(orders?.map(o => [o.id, o]) || [])

  // Combine
  return conversations.map(conv => ({
    ...conv,
    order: conv.order_id ? ordersMap.get(conv.order_id) || null : null,
  }))
}

/**
 * Get a single conversation with order data
 */
export async function getConversationWithOrder(
  conversationId: string
): Promise<ConversationWithOrder | null> {
  const conversation = await d1GetConversationById(conversationId)
  if (!conversation) return null

  if (!conversation.order_id) {
    return { ...conversation, order: null }
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id, customer_name, status, payment_status, song_type, delivery_type, audio_url, generated_lyric, total_price, email, hyperfollow_url')
    .eq('id', conversation.order_id)
    .single()

  return { ...conversation, order: order || null }
}

/**
 * Auto-link a conversation to the most recent order by phone number
 */
export async function autoLinkToOrder(phoneNumber: string): Promise<string | null> {
  // Find most recent order with this phone number
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, customer_name')
    .eq('whatsapp', phoneNumber)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !order) {
    return null
  }

  // Find conversation
  const conversation = await d1GetConversationByPhone(phoneNumber)
  if (!conversation) {
    return null
  }

  // Link conversation to order
  await d1LinkToOrder(conversation.id, order.id)

  // Update customer name if available
  if (order.customer_name) {
    await d1Query(
      'UPDATE conversations SET customer_name = ? WHERE id = ?',
      [order.customer_name, conversation.id]
    )
  }

  return order.id
}

/**
 * Create a new conversation
 */
export async function createConversation(
  phoneNumber: string,
  customerName?: string
): Promise<Conversation> {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await d1Query(
    `INSERT INTO conversations (id, phone_number, customer_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, phoneNumber, customerName || null, now, now]
  )

  // Try to auto-link to order
  const orderId = await autoLinkToOrder(phoneNumber)

  const result = await d1GetConversationById(id)
  if (!result) {
    throw new Error(`Failed to retrieve created conversation with id: ${id}`)
  }
  return result
}

/**
 * Mark conversation as read
 */
export async function markAsRead(conversationId: string): Promise<void> {
  await d1MarkAsRead(conversationId)
}

/**
 * Get conversation by phone number
 */
export async function getConversationByPhone(phone: string): Promise<Conversation | null> {
  return d1GetConversationByPhone(phone)
}

/**
 * Get conversation by ID
 */
export async function getConversationById(id: string): Promise<Conversation | null> {
  return d1GetConversationById(id)
}

/**
 * Link conversation to order
 */
export async function linkToOrder(conversationId: string, orderId: string): Promise<void> {
  await d1LinkToOrder(conversationId, orderId)
}
