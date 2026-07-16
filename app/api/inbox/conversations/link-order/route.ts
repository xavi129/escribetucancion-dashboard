import { NextResponse } from 'next/server'
import { linkOrderToConversation } from '@/lib/d1-client'

/**
 * POST /api/inbox/conversations/link-order
 * 
 * Link an order from Supabase to a conversation in D1.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { conversationId, orderId } = body

    if (!conversationId || !orderId) {
      return NextResponse.json(
        { success: false, error: 'conversationId and orderId are required' },
        { status: 400 }
      )
    }

    await linkOrderToConversation(conversationId, orderId)

    return NextResponse.json({
      success: true,
      message: 'Order linked successfully',
    })
  } catch (error) {
    console.error('[Link Order] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al vincular orden' },
      { status: 500 }
    )
  }
}
