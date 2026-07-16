import { NextResponse } from 'next/server'
import {
  sendSongConfirmation,
  sendLyricApproval,
  sendPaymentReminder,
  sendDeliveryOptions,
  sendSongWithPlayer,
  sendCTAMessage,
} from '@/lib/whatsapp-business'
import { 
  createMessage, 
  calculateWindowStatus,
  d1Query 
} from '@/lib/d1-client'

interface InteractiveMessageRequest {
  phoneNumber: string
  conversationId: string
  action: 'song_confirmation' | 'lyric_approval' | 'payment_reminder' | 'delivery_options' | 'song_player' | 'spotify'
  data: {
    customerName?: string
    audioUrl?: string
    lyric?: string
    totalPrice?: number
    playUrl?: string
    hyperfollowUrl?: string
    orderId?: string
  }
}

export async function POST(request: Request) {
  try {
    const body: InteractiveMessageRequest = await request.json()
    const { phoneNumber, conversationId, action, data } = body

    if (!phoneNumber || !conversationId || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get conversation and validate 24-hour window
    const conversation = await d1Query<any>(
      'SELECT * FROM conversations WHERE id = ?', 
      [conversationId]
    ).then(r => r.results[0])

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Check 24-hour window for interactive messages
    const windowStatus = calculateWindowStatus(conversation.last_incoming_at)
    
    if (!windowStatus.isOpen) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'La ventana de 24 horas ha expirado.',
          windowClosed: true 
        },
        { status: 400 }
      )
    }

    const customerName = data.customerName || 'Cliente'
    let result
    let messageContent = ''

    switch (action) {
      case 'song_confirmation':
        if (!data.audioUrl) {
          return NextResponse.json(
            { success: false, error: 'Audio URL required' },
            { status: 400 }
          )
        }
        result = await sendSongConfirmation(phoneNumber, data.audioUrl, customerName)
        messageContent = `[Confirmación de canción con botones] ¿Te gusta como quedó tu canción?`
        break

      case 'lyric_approval':
        if (!data.lyric) {
          return NextResponse.json(
            { success: false, error: 'Lyric required' },
            { status: 400 }
          )
        }
        result = await sendLyricApproval(phoneNumber, customerName, data.lyric)
        messageContent = `[Aprobación de letra con botones] ${data.lyric.slice(0, 100)}...`
        break

      case 'payment_reminder': {
        const paymentUrl = data.orderId 
          ? `${process.env.NEXT_PUBLIC_BASE_URL}/pay/${data.orderId}`
          : `${process.env.NEXT_PUBLIC_BASE_URL}/pay`
        result = await sendPaymentReminder(
          phoneNumber,
          customerName,
          data.totalPrice || 0,
          paymentUrl
        )
        messageContent = `[Recordatorio de pago con botón] Total: $${data.totalPrice || 0} MXN`
        break
      }

      case 'delivery_options':
        result = await sendDeliveryOptions(
          phoneNumber,
          customerName,
          0, // Standard is included
          299 // Express extra cost
        )
        messageContent = `[Opciones de entrega con lista] Estándar vs Express`
        break

      case 'song_player':
        if (!data.playUrl) {
          return NextResponse.json(
            { success: false, error: 'Play URL required' },
            { status: 400 }
          )
        }
        result = await sendSongWithPlayer(phoneNumber, customerName, data.playUrl)
        messageContent = `[Player de canción con botón] ${data.playUrl}`
        break

      case 'spotify':
        if (!data.hyperfollowUrl) {
          return NextResponse.json(
            { success: false, error: 'Hyperfollow URL required' },
            { status: 400 }
          )
        }
        result = await sendCTAMessage(
          phoneNumber,
          `🎧 ¡${customerName}, tu canción ya está en Spotify!\n\nHaz clic para pre-guardarla y ser de los primeros en escucharla cuando se publique.`,
          '🎵 Pre-guardar',
          data.hyperfollowUrl,
          {
            header: '🎉 ¡En Spotify!',
            footer: 'EscribeTuCancion.com',
          }
        )
        messageContent = `[Link Spotify con botón] ${data.hyperfollowUrl}`
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    // Save message to D1 - handle persistence errors separately
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
      console.error('[Send Interactive] Message sent successfully but failed to save to database:', {
        wamid: result.wamid,
        conversationId,
        error: persistenceError
      })
      
      // Return success since WhatsApp message was sent, but log the persistence issue
      return NextResponse.json({
        success: true,
        wamid: result.wamid,
        warning: 'Message sent but not saved to database'
      })
    }

    return NextResponse.json({
      success: true,
      wamid: result.wamid,
    })
  } catch (error) {
    console.error('[Send Interactive] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error sending interactive message' },
      { status: 500 }
    )
  }
}
