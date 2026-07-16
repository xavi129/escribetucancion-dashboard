/**
 * Shared types for WhatsApp Inbox
 */

import type { Order } from './supabase'

// ============================================
// Conversation Types
// ============================================

export interface Conversation {
  id: string
  phone_number: string
  customer_name: string | null
  last_message: string | null
  last_message_at: string | null
  last_incoming_at: string | null
  unread_count: number
  order_id: string | null
  created_at: string
  updated_at: string
}

export interface ConversationWithOrder extends Conversation {
  order?: Partial<Order> | null
}

export interface ConversationFilters {
  search?: string
  orderStatus?: string
  unreadOnly?: boolean
}

// ============================================
// Message Types
// ============================================

export interface Message {
  id: string
  conversation_id: string
  wamid: string | null
  direction: 'incoming' | 'outgoing'
  type: 'text' | 'template' | 'audio' | 'image' | 'document'
  content: string
  media_url: string | null
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  source: 'operator' | 'agent' | 'system'
  created_at: string
}

// ============================================
// Window Status Types
// ============================================

export interface WindowStatus {
  isOpen: boolean
  expiresAt: Date | null
  remainingMs: number
  remainingFormatted: string
}

// ============================================
// Template Types
// ============================================

export interface MessageTemplate {
  id: string
  name: string
  category: string
  content: string
  variables: string[]
  created_at: string
}

export interface TemplateCategory {
  name: string
  templates: MessageTemplate[]
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

export interface ConversationsResponse extends ApiResponse {
  conversations: ConversationWithOrder[]
  count: number
}

export interface MessagesResponse extends ApiResponse {
  messages: Message[]
  conversation: Conversation
}

export interface SendMessageResponse extends ApiResponse {
  wamid?: string
  messageId?: string
  conversationId?: string
}
