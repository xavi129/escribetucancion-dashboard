import { NextResponse } from 'next/server'
import { sendReaction, removeReaction, markAsRead } from '@/lib/whatsapp-business'

/**
 * POST /api/whatsapp/react
 * 
 * Send a reaction to a message or mark as read.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phoneNumber, messageId, emoji, action } = body

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'messageId is required' },
        { status: 400 }
      )
    }

    let result

    if (action === 'markAsRead') {
      result = await markAsRead(messageId)
    } else if (action === 'removeReaction') {
      if (!phoneNumber) {
        return NextResponse.json(
          { success: false, error: 'phoneNumber is required' },
          { status: 400 }
        )
      }
      result = await removeReaction(phoneNumber, messageId)
    } else {
      // Default: send reaction
      if (!phoneNumber || !emoji) {
        return NextResponse.json(
          { success: false, error: 'phoneNumber and emoji are required' },
          { status: 400 }
        )
      }
      result = await sendReaction(phoneNumber, messageId, emoji)
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[React API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error processing reaction' },
      { status: 500 }
    )
  }
}
