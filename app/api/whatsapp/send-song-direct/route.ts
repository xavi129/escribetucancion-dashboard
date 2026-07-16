import { NextResponse } from 'next/server'
import { supabase, buildPlayUrl } from '@/lib/supabase'
import { sendTextMessage, sendCTAMessage } from '@/lib/whatsapp-business'
import { createMessage } from '@/lib/d1-client'

/**
 * POST /api/whatsapp/send-song-direct
 * 
 * Send song preview/full using Meta's direct API (not SendPulse)
 */
export async function POST(request: Request) {
  try {
    const { orderId, phoneNumber, conversationId } = await request.json()

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId is required' },
        { status: 400 }
      )
    }

    // Get order from database
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (fetchError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    const phone = phoneNumber || order.whatsapp
    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'No phone number' },
        { status: 400 }
      )
    }

    if (!order.audio_url) {
      return NextResponse.json(
        { success: false, error: 'No audio available' },
        { status: 400 }
      )
    }

    // Build play URL
    const playUrl = buildPlayUrl(order.audio_url, order.payment_status, order.id)
    
    // Validate playUrl is not empty
    if (!playUrl) {
      return NextResponse.json(
        { success: false, error: 'Error al generar el link del reproductor' },
        { status: 500 }
      )
    }
    
    const customerName = order.customer_name || 'Cliente'
    const isPaid = order.payment_status === 'paid'
    const hasAlt = !!(order.audio_url_alt && order.audio_url_alt.trim())

    let result
    let messageContent = ''

    if (hasAlt) {
      // Multiple versions - send text with both links
      const playUrl2 = buildPlayUrl(order.audio_url_alt, order.payment_status, `${order.id}-v2`)
      
      // Validate playUrl2 is not empty
      if (!playUrl2) {
        return NextResponse.json(
          { success: false, error: 'Error al generar el link del reproductor para la segunda versión' },
          { status: 500 }
        )
      }
      
      if (isPaid) {
        messageContent = `🎵 ¡${customerName}, tu canción está lista!\n\nHemos creado 2 versiones para ti:\n\n🎶 Versión 1:\n${playUrl}\n\n🎶 Versión 2:\n${playUrl2}\n\n¿Cuál te gusta más? 💖`
      } else {
        messageContent = `🎵 ¡${customerName}, tu canción está lista!\n\nHemos creado 2 versiones para ti:\n\n🎶 Versión 1 (preview 70s):\n${playUrl}\n\n🎶 Versión 2 (preview 70s):\n${playUrl2}\n\nConfirma tu pago para recibir las versiones completas 💳`
      }
      
      result = await sendTextMessage(phone, messageContent)
    } else {
      // Single version - send CTA button
      if (isPaid) {
        result = await sendCTAMessage(
          phone,
          `🎵 ¡${customerName}, tu canción está lista!\n\nHaz clic para escucharla completa. ¡Esperamos que te encante! 💖`,
          '▶️ Escuchar',
          playUrl!,
          {
            header: '🎁 Tu Canción',
            footer: 'EscribeTuCancion.com',
          }
        )
        messageContent = `[Canción completa con botón] ${playUrl}`
      } else {
        result = await sendCTAMessage(
          phone,
          `🎵 ¡${customerName}, tu canción está lista!\n\nEscucha el preview de 70 segundos. Confirma tu pago para la versión completa 💳`,
          '▶️ Preview',
          playUrl!,
          {
            header: '🎧 Preview',
            footer: 'EscribeTuCancion.com',
          }
        )
        messageContent = `[Preview 70s con botón] ${playUrl}`
      }
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    // Save to D1 if conversationId provided - handle persistence errors separately
    let persistenceSuccessful = true
    if (conversationId) {
      try {
        await createMessage({
          conversation_id: conversationId,
          wamid: result.wamid,
          direction: 'outgoing',
          type: 'interactive',
          content: messageContent,
          status: 'sent',
          source: 'operator',
        })
      } catch (persistenceError) {
        console.error('[Send Song Direct] Message sent successfully but failed to save to database:', {
          wamid: result.wamid,
          conversationId,
          error: persistenceError
        })
        
        // Mark persistence as failed but continue execution since WhatsApp message was sent successfully
        persistenceSuccessful = false
      }
    }

    const response: any = {
      success: true,
      wamid: result.wamid,
      playUrl,
      isPaid,
      hasMultipleVersions: hasAlt,
    }

    // Only add warning if persistence actually failed
    if (!persistenceSuccessful) {
      response.warning = 'Message sent but database save may have failed'
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Send Song Direct] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
