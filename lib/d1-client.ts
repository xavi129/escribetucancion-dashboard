/**
 * Cloudflare D1 Client for Next.js
 * 
 * Provides access to D1 database from Next.js API routes
 * using Cloudflare's REST API.
 */

const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4'

interface D1Config {
  accountId: string
  databaseId: string
  apiToken: string
}

interface D1QueryResult<T = Record<string, unknown>> {
  results: T[]
  success: boolean
  meta: {
    changes: number
    duration: number
    last_row_id: number
    rows_read: number
    rows_written: number
  }
}

interface D1Response<T = Record<string, unknown>> {
  result: D1QueryResult<T>[]
  success: boolean
  errors: Array<{ code: number; message: string }>
  messages: string[]
}

function getConfig(): D1Config {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID
  const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN

  if (!accountId || !databaseId || !apiToken) {
    throw new Error(
      'Missing Cloudflare D1 configuration. Required: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_D1_API_TOKEN'
    )
  }

  return { accountId, databaseId, apiToken }
}

/**
 * Execute a SQL query against D1
 */
export async function d1Query<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | null)[] = []
): Promise<D1QueryResult<T>> {
  const config = getConfig()
  
  const url = `${CLOUDFLARE_API_URL}/accounts/${config.accountId}/d1/database/${config.databaseId}/query`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql,
      params,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[D1] Query failed:', response.status, errorText)
    throw new Error(`D1 query failed: ${response.status} ${errorText}`)
  }

  const data = await response.json() as D1Response<T>
  
  if (!data.success) {
    console.error('[D1] Query error:', data.errors)
    throw new Error(`D1 query error: ${data.errors.map(e => e.message).join(', ')}`)
  }

  return data.result[0]
}

/**
 * Execute multiple SQL statements in a batch
 */
export async function d1Batch(
  statements: Array<{ sql: string; params?: (string | number | null)[] }>
): Promise<D1QueryResult[]> {
  const config = getConfig()
  
  const url = `${CLOUDFLARE_API_URL}/accounts/${config.accountId}/d1/database/${config.databaseId}/query`
  
  // D1 REST API doesn't support true batching, so we execute sequentially
  const results: D1QueryResult[] = []
  
  for (const stmt of statements) {
    const result = await d1Query(stmt.sql, stmt.params || [])
    results.push(result)
  }
  
  return results
}

// ============================================
// Conversation Operations
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

export interface ConversationFilters {
  search?: string
  orderStatus?: string
  unreadOnly?: boolean
  limit?: number
  offset?: number
}

/**
 * Get all conversations with optional filters
 */
export async function getConversations(filters?: ConversationFilters): Promise<Conversation[]> {
  let sql = 'SELECT * FROM conversations'
  const conditions: string[] = []
  const params: (string | number)[] = []

  if (filters?.search) {
    conditions.push('(phone_number LIKE ? OR customer_name LIKE ?)')
    params.push(`%${filters.search}%`, `%${filters.search}%`)
  }

  if (filters?.unreadOnly) {
    conditions.push('unread_count > 0')
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }

  sql += ' ORDER BY last_message_at DESC'

  // Add pagination with proper validation and parameterization
  if (filters?.limit) {
    // Validate and convert limit to integer
    const limit = parseInt(String(filters.limit), 10)
    if (!Number.isInteger(limit) || limit <= 0 || limit > 1000) {
      throw new Error('Invalid limit value. Must be a positive integer between 1 and 1000.')
    }
    
    sql += ' LIMIT ?'
    params.push(limit)
    
    if (filters?.offset) {
      // Validate and convert offset to integer
      const offset = parseInt(String(filters.offset), 10)
      if (!Number.isInteger(offset) || offset < 0) {
        throw new Error('Invalid offset value. Must be a non-negative integer.')
      }
      
      sql += ' OFFSET ?'
      params.push(offset)
    }
  }

  const result = await d1Query<Conversation>(sql, params)
  return result.results
}

/**
 * Get a conversation by phone number
 */
export async function getConversationByPhone(phone: string): Promise<Conversation | null> {
  const result = await d1Query<Conversation>(
    'SELECT * FROM conversations WHERE phone_number = ?',
    [phone]
  )
  return result.results[0] || null
}

/**
 * Get a conversation by ID
 */
export async function getConversationById(id: string): Promise<Conversation | null> {
  const result = await d1Query<Conversation>(
    'SELECT * FROM conversations WHERE id = ?',
    [id]
  )
  return result.results[0] || null
}

/**
 * Mark a conversation as read
 */
export async function markConversationAsRead(conversationId: string): Promise<void> {
  await d1Query(
    'UPDATE conversations SET unread_count = 0, updated_at = datetime("now") WHERE id = ?',
    [conversationId]
  )
}

/**
 * Link a conversation to an order
 */
export async function linkConversationToOrder(conversationId: string, orderId: string): Promise<void> {
  // Validate that orderId is a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(orderId)) {
    console.error(`[linkConversationToOrder] Invalid order ID format: "${orderId}". Expected UUID format.`)
    throw new Error(`Invalid order ID format: "${orderId}". Expected UUID format.`)
  }

  await d1Query(
    'UPDATE conversations SET order_id = ?, updated_at = datetime("now") WHERE id = ?',
    [orderId, conversationId]
  )
}

// Alias for consistency
export const linkOrderToConversation = linkConversationToOrder

// ============================================
// Message Operations
// ============================================

export interface Message {
  id: string
  conversation_id: string
  wamid: string | null
  direction: 'incoming' | 'outgoing'
  type: string
  content: string
  media_url: string | null
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  source: 'operator' | 'agent' | 'system'
  created_at: string
}

/**
 * Get messages for a conversation
 */
export async function getMessages(conversationId: string, options?: { page?: number; limit?: number }): Promise<Message[]> {
  let sql = 'SELECT * FROM messages WHERE conversation_id = ?'
  const params: (string | number)[] = [conversationId]

  if (options?.limit) {
    // Validate and convert limit to integer
    const limit = parseInt(String(options.limit), 10)
    if (!Number.isInteger(limit) || limit <= 0 || limit > 1000) {
      throw new Error('Invalid limit value. Must be a positive integer between 1 and 1000.')
    }

    // For pagination, we get messages in reverse order (newest first) then reverse the result
    sql += ' ORDER BY created_at DESC'
    sql += ' LIMIT ?'
    params.push(limit)
    
    if (options.page && options.page > 1) {
      // Validate and convert page to integer
      const page = parseInt(String(options.page), 10)
      if (!Number.isInteger(page) || page <= 0) {
        throw new Error('Invalid page value. Must be a positive integer.')
      }
      
      const offset = (page - 1) * limit
      sql += ' OFFSET ?'
      params.push(offset)
    }
    
    const result = await d1Query<Message>(sql, params)
    // Reverse to show oldest first (normal chat order)
    return result.results.reverse()
  } else {
    // Default behavior - all messages oldest first
    sql += ' ORDER BY created_at ASC'
    const result = await d1Query<Message>(sql, params)
    return result.results
  }
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
  const id = crypto.randomUUID()
  
  await d1Query(
    `INSERT INTO messages (id, conversation_id, wamid, direction, type, content, media_url, status, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.conversation_id,
      data.wamid || null,
      data.direction,
      data.type,
      data.content,
      data.media_url || null,
      data.status,
      data.source || 'operator',
    ]
  )

  // Update conversation
  await d1Query(
    `UPDATE conversations 
     SET last_message = ?, last_message_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`,
    [data.content, data.conversation_id]
  )

  const result = await d1Query<Message>(
    'SELECT * FROM messages WHERE id = ?',
    [id]
  )
  
  return result.results[0]
}

/**
 * Update message status
 */
export async function updateMessageStatus(wamid: string, status: string): Promise<void> {
  await d1Query(
    'UPDATE messages SET status = ? WHERE wamid = ?',
    [status, wamid]
  )
}

// ============================================
// 24-Hour Window Utilities
// ============================================

export interface WindowStatus {
  isOpen: boolean
  expiresAt: Date | null
  remainingMs: number
  remainingFormatted: string
}

/**
 * Calculate the 24-hour window status for a conversation
 */
export function calculateWindowStatus(lastIncomingAt: string | null): WindowStatus {
  if (!lastIncomingAt) {
    return {
      isOpen: false,
      expiresAt: null,
      remainingMs: 0,
      remainingFormatted: 'Sin mensajes',
    }
  }

  const lastMessage = new Date(lastIncomingAt)
  const expiresAt = new Date(lastMessage.getTime() + 24 * 60 * 60 * 1000)
  const remainingMs = expiresAt.getTime() - Date.now()

  if (remainingMs <= 0) {
    return {
      isOpen: false,
      expiresAt,
      remainingMs: 0,
      remainingFormatted: 'Ventana cerrada',
    }
  }

  const hours = Math.floor(remainingMs / (1000 * 60 * 60))
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000)

  return {
    isOpen: true,
    expiresAt,
    remainingMs,
    remainingFormatted: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
  }
}
