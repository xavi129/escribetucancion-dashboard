import { NextResponse } from "next/server"
import { verifySendPulseWebhook, parseSendPulseWebhook } from "@/lib/sendpulse"
import { supabase } from "@/lib/supabase"

/**
 * SendPulse Webhook Endpoint
 * 
 * Receives incoming WhatsApp messages from SendPulse and processes them.
 * This endpoint should be configured in SendPulse dashboard as the webhook URL:
 * https://your-domain.com/api/webhook/sendpulse
 */

export async function POST(request: Request) {
  try {
    const payload = await request.json()

    console.log('[SendPulse Webhook] Received webhook:', JSON.stringify(payload, null, 2))

    // Verify that the webhook comes from our configured bot
    if (!verifySendPulseWebhook(payload)) {
      console.error('[SendPulse Webhook] Webhook verification failed')
      return NextResponse.json(
        { success: false, message: 'Invalid webhook signature' },
        { status: 401 }
      )
    }

    // Parse the webhook to extract phone number and message
    const { phoneNumber, messageBody } = parseSendPulseWebhook(payload)

    if (!phoneNumber || !messageBody) {
      console.error('[SendPulse Webhook] Invalid webhook payload')
      return NextResponse.json(
        { success: false, message: 'Invalid payload format' },
        { status: 400 }
      )
    }

    console.log('[SendPulse Webhook] Processing message from:', phoneNumber)

    // Look up the customer in the database by phone number
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('whatsapp', phoneNumber)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (orderError) {
      console.log('[SendPulse Webhook] No order found for phone:', phoneNumber)
      
      // You can implement auto-response for unknown numbers here
      // For now, we just log and return success
      return NextResponse.json({
        success: true,
        message: 'Message received but no order found',
        action: 'logged'
      })
    }

    console.log('[SendPulse Webhook] Found order:', order.id)

    // Process the message based on content
    const messageLower = messageBody.toLowerCase().trim()

    // Check if customer is confirming the lyric
    if (messageLower.includes('confirmo letra') || messageLower.includes('confirmar letra')) {
      console.log('[SendPulse Webhook] Customer confirmed lyric')
      
      // Update order status to confirmed
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          lyric_confirmed: true,
          lyric_confirmed_at: new Date().toISOString()
        })
        .eq('id', order.id)

      if (updateError) {
        console.error('[SendPulse Webhook] Error updating order:', updateError)
      }

      // You can trigger song generation here or notify your team
      // For now, just log it
      console.log('[SendPulse Webhook] Lyric confirmed for order:', order.id)
    }
    // Check if customer wants to edit the lyric
    // NOTE: The actual editing is handled by the Worker Agent using the edit_lyric tool
    // This webhook just stores the request in notes for reference
    else if (messageLower.includes('editar letra')) {
      console.log('[SendPulse Webhook] Customer wants to edit lyric - storing in notes')
      
      // Extract the edit request (everything after "editar letra")
      const editRequest = messageBody
        .replace(/editar\s+letra/i, '')
        .trim()

      // Store the edit request in notes for reference
      // The Worker Agent will handle the actual editing via the edit_lyric tool
      const existingNotes = order.notes || ''
      const newNote = `[${new Date().toISOString()}] Cliente solicitó edición de letra: "${editRequest}"`
      const updatedNotes = existingNotes 
        ? `${existingNotes}\n\n${newNote}`
        : newNote

      const { error: updateError } = await supabase
        .from('orders')
        .update({ notes: updatedNotes })
        .eq('id', order.id)

      if (updateError) {
        console.error('[SendPulse Webhook] Error storing edit request in notes:', updateError)
      } else {
        console.log('[SendPulse Webhook] Edit request stored in notes for order:', order.id)
      }
    }
    // Any other message - store as customer note
    else {
      console.log('[SendPulse Webhook] Storing message as customer note')
      
      // Append to notes
      const existingNotes = order.notes || ''
      const newNote = `[${new Date().toISOString()}] Cliente escribió: ${messageBody}`
      const updatedNotes = existingNotes 
        ? `${existingNotes}\n\n${newNote}`
        : newNote

      const { error: updateError } = await supabase
        .from('orders')
        .update({ notes: updatedNotes })
        .eq('id', order.id)

      if (updateError) {
        console.error('[SendPulse Webhook] Error updating notes:', updateError)
      }
    }

    // Return 200 OK immediately (SendPulse expects fast response)
    console.log('[SendPulse Webhook] Message processed successfully for:', phoneNumber)
    
    return NextResponse.json({
      success: true,
      message: 'Message processed successfully'
    })

  } catch (error) {
    console.error('[SendPulse Webhook] Error processing webhook:', error)
    
    // Return 200 even on error to prevent SendPulse from retrying
    // But log the error for investigation
    return NextResponse.json(
      { success: false, message: 'Error processing message', error: String(error) },
      { status: 200 } // Still return 200 to prevent retries
    )
  }
}

// Handle GET requests (for webhook verification during setup)
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'SendPulse webhook endpoint is active',
    timestamp: new Date().toISOString()
  })
}
