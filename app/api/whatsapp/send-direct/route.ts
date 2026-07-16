import { NextResponse } from 'next/server'
import { 
  sendTextMessage, 
  sendTemplateMessage, 
  sendAudioMessage,
  type TemplateContent 
} from '@/lib/whatsapp-business'
import { 
  createMessage, 
  getConversationByPhone, 
  calculateWindowStatus,
  d1Query 
} from '@/lib/d1-client'
import { supabase } from '@/lib/supabase'

/**
 * POST /api/whatsapp/send-direct
 * 
 * Send a message via WhatsApp Business API.
 * Validates 24-hour window for non-template messages.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { 
      phoneNumber, 
      message, 
      type = 'text',
      templateName,
      templateParams,
      audioUrl,
      conversationId 
    } = body

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'phoneNumber is required' },
        { status: 400 }
      )
    }

    // Get or find conversation
    let conversation = conversationId 
      ? await d1Query<any>('SELECT * FROM conversations WHERE id = ?', [conversationId])
          .then(r => r.results && r.results.length > 0 ? r.results[0] : null)
          .catch(() => null)
      : await getConversationByPhone(phoneNumber)

    // Check 24-hour window for non-template messages
    if (type !== 'template' && conversation) {
      const windowStatus = calculateWindowStatus(conversation.last_incoming_at)
      
      if (!windowStatus.isOpen) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'La ventana de 24 horas ha expirado. Usa un template para reiniciar la conversación.',
            windowClosed: true 
          },
          { status: 400 }
        )
      }
    }

    // Send message based on type
    let result
    let content = message

    switch (type) {
      case 'template': {
        if (!templateName) {
          return NextResponse.json(
            { success: false, error: 'templateName is required for template messages' },
            { status: 400 }
          )
        }
        
        const template: TemplateContent = {
          name: templateName,
          language: { code: 'es' },
          components: templateParams || [],
        }
        
        result = await sendTemplateMessage(phoneNumber, template)
        content = `[Template: ${templateName}]`
        break
      }

      case 'audio':
        if (!audioUrl) {
          return NextResponse.json(
            { success: false, error: 'audioUrl is required for audio messages' },
            { status: 400 }
          )
        }
        
        result = await sendAudioMessage(phoneNumber, audioUrl)
        content = '[Audio]'
        break

      case 'text':
      default:
        if (!message) {
          return NextResponse.json(
            { success: false, error: 'message is required for text messages' },
            { status: 400 }
          )
        }
        
        result = await sendTextMessage(phoneNumber, message)
        break
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    // Create conversation if it doesn't exist
    if (!conversation) {
      const id = crypto.randomUUID()
      await d1Query(
        `INSERT INTO conversations (id, phone_number, last_message, last_message_at)
         VALUES (?, ?, ?, datetime('now'))`,
        [id, phoneNumber, content]
      )
      
      // Try to auto-link to order
      const { data: order } = await supabase
        .from('orders')
        .select('id')
        .eq('whatsapp', phoneNumber)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      // Validate order ID format before using it
      let validatedOrderId = null
      if (order) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        if (uuidRegex.test(order.id)) {
          validatedOrderId = order.id
        } else {
          console.error(`[Send Direct] Invalid order ID format: "${order.id}". Skipping order link.`)
        }
      }

      // Update conversation with validated order ID only if valid
      if (validatedOrderId) {
        await d1Query(
          'UPDATE conversations SET order_id = ? WHERE id = ?',
          [validatedOrderId, id]
        )
      }

      conversation = { id, phone_number: phoneNumber, order_id: validatedOrderId }
    }

    // Store outgoing message in D1 - handle persistence errors separately
    try {
      const storedMessage = await createMessage({
        conversation_id: conversation.id,
        wamid: result.wamid || null,
        direction: 'outgoing',
        type: type,
        content: content,
        status: 'sent',
        source: 'operator',
      })

      return NextResponse.json({
        success: true,
        wamid: result.wamid,
        messageId: storedMessage.id,
        conversationId: conversation.id,
      })
    } catch (persistenceError) {
      console.error('[Send Direct] Message sent successfully but failed to save to database:', {
        wamid: result.wamid,
        conversationId: conversation.id,
        error: persistenceError
      })
      
      // Return success since WhatsApp message was sent, but log the persistence issue
      return NextResponse.json({
        success: true,
        wamid: result.wamid,
        conversationId: conversation.id,
        warning: 'Message sent but not saved to database'
      })
    }
  } catch (error) {
    console.error('[Send Direct API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al enviar mensaje' },
      { status: 500 }
    )
  }
}
