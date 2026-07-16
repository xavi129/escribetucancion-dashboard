import { NextResponse } from 'next/server'
import { getConversations, markConversationAsRead, type ConversationFilters } from '@/lib/d1-client'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/inbox/conversations
 * 
 * List all conversations with optional filters.
 * Includes order data from Supabase (cross-database).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    
    // Parse pagination params
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const offset = (page - 1) * limit
    
    // Parse filters from query params
    const filters: ConversationFilters = {
      limit,
      offset
    }
    
    const search = url.searchParams.get('search')
    if (search) filters.search = search
    
    const unreadOnly = url.searchParams.get('unreadOnly')
    if (unreadOnly === 'true') filters.unreadOnly = true
    
    const orderStatus = url.searchParams.get('orderStatus')
    if (orderStatus) filters.orderStatus = orderStatus

    // Get conversations from D1
    const conversations = await getConversations(filters)

    // Log any conversations with invalid order_ids for debugging
    const invalidOrderIds = conversations
      .filter(c => c.order_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(c.order_id))
    
    if (invalidOrderIds.length > 0) {
      console.warn('[Conversations API] Found conversations with invalid order_ids:', 
        invalidOrderIds.map(c => ({ id: c.id, phone: c.phone_number, order_id: c.order_id }))
      )
    }

    // Get order IDs that need to be fetched (filter out invalid UUIDs)
    const orderIds = conversations
      .map(c => c.order_id)
      .filter((id): id is string => {
        if (!id) return false
        // Check if it's a valid UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        return uuidRegex.test(id)
      })

    // Fetch orders from Supabase (cross-database)
    let ordersMap: Record<string, any> = {}
    
    if (orderIds.length > 0) {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, customer_name, status, payment_status, song_type, delivery_type, audio_url, generated_lyric')
        .in('id', orderIds)

      if (error) {
        console.error('[Conversations API] Error fetching orders:', error)
      } else if (orders) {
        ordersMap = Object.fromEntries(orders.map(o => [o.id, o]))
      }
    }

    // Filter by order status if specified (post-fetch filter)
    let filteredConversations = conversations
    if (orderStatus) {
      filteredConversations = conversations.filter(c => {
        if (!c.order_id) return false
        const order = ordersMap[c.order_id]
        return order?.status === orderStatus
      })
    }

    // Combine conversations with order data
    const conversationsWithOrders = filteredConversations.map(conv => ({
      ...conv,
      order: conv.order_id ? ordersMap[conv.order_id] || null : null,
    }))

    return NextResponse.json({
      success: true,
      conversations: conversationsWithOrders,
      count: conversationsWithOrders.length,
      pagination: {
        page,
        limit,
        // Fix: Use original fetched conversations length for hasMore calculation
        // This ensures pagination works correctly even when orderStatus filtering is applied
        hasMore: conversations.length === limit
      }
    })
  } catch (error) {
    console.error('[Conversations API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al cargar conversaciones' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/inbox/conversations
 * 
 * Mark a conversation as read.
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { conversationId, action } = body

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversationId is required' },
        { status: 400 }
      )
    }

    if (action === 'markAsRead') {
      await markConversationAsRead(conversationId)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('[Conversations API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar conversación' },
      { status: 500 }
    )
  }
}
