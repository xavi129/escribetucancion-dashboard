import { NextResponse } from 'next/server'
import { getMessages, getConversationById } from '@/lib/d1-client'

/**
 * GET /api/inbox/messages?conversationId=xxx
 * 
 * Get all messages for a conversation.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const conversationId = url.searchParams.get('conversationId')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversationId is required' },
        { status: 400 }
      )
    }

    // Verify conversation exists
    const conversation = await getConversationById(conversationId)
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Get messages with pagination (newest first for pagination, then reverse)
    const messages = await getMessages(conversationId, { page, limit })

    return NextResponse.json({
      success: true,
      messages,
      conversation,
      pagination: {
        page,
        limit,
        hasMore: messages.length === limit
      }
    })
  } catch (error) {
    console.error('[Messages API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al cargar mensajes' },
      { status: 500 }
    )
  }
}
