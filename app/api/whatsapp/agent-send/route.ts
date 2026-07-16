import { NextResponse } from 'next/server'
import { 
  sendTextMessage, 
  sendTemplateMessage,
  type TemplateContent 
} from '@/lib/whatsapp-business'
import { 
  createMessage, 
  getConversationByPhone,
  d1Query 
} from '@/lib/d1-client'
import { supabase } from '@/lib/supabase'

/**
 * POST /api/whatsapp/agent-send
 * 
 * Endpoint for external agents to send messages.
 * Requires API key authentication.
 */
export async function POST(request: Request) {
  try {
    // Validate API key
    const apiKey = request.headers.get('X-API-Key')
    const expectedKey = process.env.AGENT_API_KEY

    if (!expectedKey || apiKey !== expectedKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { 
      phone_number, 
      message, 
      type = 'text',
      template_name,
      template_params 
    } = body

    if (!phone_number) {
      return NextResponse.json(
        { success: false, error: 'phone_number is required' },
        { status: 400 }
      )
    }

    if (type === 'text' && !message) {
      return NextResponse.json(
        { success: false, error: 'message is required for text messages' },
        { status: 400 }
      )
    }

    if (type === 'template') {
      if (!template_name || typeof template_name !== 'string' || template_name.trim() === '') {
        return NextResponse.json(
          { success: false, error: 'template_name is required and must be a non-empty string for template messages' },
          { status: 400 }
        )
      }

      if (template_params && !Array.isArray(template_params)) {
        return NextResponse.json(
          { success: false, error: 'template_params must be an array' },
          { status: 400 }
        )
      }
    }

    // Find or create conversation
    let conversation = await getConversationByPhone(phone_number)

    if (!conversation) {
      // Create new conversation
      const id = crypto.randomUUID()
      await d1Query(
        `INSERT INTO conversations (id, phone_number, last_message, last_message_at)
         VALUES (?, ?, ?, datetime('now'))`,
        [id, phone_number, message || `[Template: ${template_name}]`]
      )

      // Auto-link to most recent order
      const { data: order } = await supabase
        .from('orders')
        .select('id, customer_name')
        .eq('whatsapp', phone_number)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (order) {
        // Validate order ID format before using it
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        const isValidOrderId = uuidRegex.test(order.id)
        
        if (!isValidOrderId) {
          console.error(`[Agent Send] Invalid order ID format: "${order.id}". Skipping order link.`)
        } else {
          await d1Query(
            'UPDATE conversations SET order_id = ?, customer_name = ? WHERE id = ?',
            [order.id, order.customer_name, id]
          )
        }

        conversation = { 
          id, 
          phone_number, 
          order_id: isValidOrderId ? order.id : null,
          customer_name: order.customer_name || null,
          last_message: null,
          last_message_at: null,
          last_incoming_at: null,
          unread_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      } else {
        conversation = { 
          id, 
          phone_number, 
          order_id: null,
          customer_name: null,
          last_message: null,
          last_message_at: null,
          last_incoming_at: null,
          unread_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      }
    }

    // Send message
    let result
    let content = message

    if (type === 'template') {
      const template: TemplateContent = {
        name: template_name!,
        language: { code: 'es' },
        components: template_params || [],
      }
      
      result = await sendTemplateMessage(phone_number, template)
      content = `[Template: ${template_name}]`
    } else {
      result = await sendTextMessage(phone_number, message)
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    // Store message with source='agent' - handle persistence errors separately
    try {
      const storedMessage = await createMessage({
        conversation_id: conversation!.id,
        wamid: result.wamid || null,
        direction: 'outgoing',
        type: type,
        content: content,
        status: 'sent',
        source: 'agent',
      })

      return NextResponse.json({
        success: true,
        wamid: result.wamid,
        message_id: storedMessage.id,
        conversation_id: conversation!.id,
        order_id: conversation!.order_id,
      })
    } catch (persistenceError) {
      console.error('[Agent Send] Message sent successfully but failed to save to database:', {
        wamid: result.wamid,
        conversationId: conversation!.id,
        error: persistenceError
      })
      
      // Return success since WhatsApp message was sent, but log the persistence issue
      return NextResponse.json({
        success: true,
        wamid: result.wamid,
        conversation_id: conversation!.id,
        order_id: conversation!.order_id,
        warning: 'Message sent but not saved to database'
      })
    }
  } catch (error) {
    console.error('[Agent Send API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al enviar mensaje' },
      { status: 500 }
    )
  }
}
