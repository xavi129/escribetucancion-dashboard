import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { sendSendPulseMessage, isSendPulseEnabled } from "@/lib/sendpulse"
import { formatPhoneNumber } from "@/lib/phone-utils"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { whatsapp, orderId, adjustmentNote } = body

    if (!whatsapp) {
      return NextResponse.json(
        { success: false, error: "WhatsApp number is required" },
        { status: 400 }
      )
    }

    // Buscar la orden del cliente
    let query = supabase
      .from("orders")
      .select("id, generated_lyric, customer_name, song_type, status")
      .eq("whatsapp", whatsapp)
      .order("created_at", { ascending: false })
      .limit(1)

    if (orderId) {
      query = query.eq("id", orderId)
    }

    const { data: order, error: orderError } = await query.single()

    if (orderError || !order) {
      return NextResponse.json(
        { 
          success: false, 
          error: "No se encontró orden para el whatsapp proporcionado",
          details: orderError?.message 
        },
        { status: 404 }
      )
    }

    // Validar que existe letra
    if (!order.generated_lyric || order.generated_lyric.trim() === "") {
      return NextResponse.json(
        { success: false, error: "La orden no tiene letra generada" },
        { status: 400 }
      )
    }

    // Preparar el mensaje
    let messageBody = `📝 *Letra de tu canción personalizada:*\n\n${order.generated_lyric}`

    // Si hay una nota de ajuste, agregarla al inicio del mensaje
    if (adjustmentNote) {
      messageBody = `${adjustmentNote}\n\n${messageBody}`
    }

    console.log('[send-lyric-whatsapp] Preparando envío:', {
      whatsapp,
      orderId: order.id,
      hasAdjustmentNote: !!adjustmentNote,
      messageLength: messageBody.length
    })

    // Formatear el número de teléfono usando la utilidad internacional
    const formattedPhoneNumber = formatPhoneNumber(whatsapp)
    console.log('[send-lyric-whatsapp] Número formateado:', formattedPhoneNumber)

    // Verificar si SendPulse está habilitado
    const useSendPulse = isSendPulseEnabled()

    if (useSendPulse) {
      console.log('[send-lyric-whatsapp] Usando SendPulse provider')
      
      const result = await sendSendPulseMessage(formattedPhoneNumber, messageBody)
      
      if (!result.success) {
        console.error('[send-lyric-whatsapp] Error con SendPulse:', result.error)
        return NextResponse.json(
          { 
            success: false, 
            error: `Error al enviar WhatsApp con SendPulse: ${result.error}`,
          },
          { status: 500 }
        )
      }

      console.log('[send-lyric-whatsapp] ✓ Enviado exitosamente con SendPulse, messageId:', result.messageId)

      return NextResponse.json({
        success: true,
        message: "Letra enviada por WhatsApp exitosamente",
        whatsapp: formattedPhoneNumber,
        orderId: order.id,
        provider: 'sendpulse',
        messageId: result.messageId,
        sentAt: new Date().toISOString()
      })
    }

    // Método antiguo (legacy)
    console.log('[send-lyric-whatsapp] Usando legacy provider')
    
    const whatsappApiUrl = process.env.WHATSAPP_API_URL
    const whatsappApiKey = process.env.WHATSAPP_API_KEY

    if (!whatsappApiUrl || !whatsappApiKey) {
      return NextResponse.json(
        { success: false, error: "Error de configuración del servidor de WhatsApp" },
        { status: 500 }
      )
    }

    // Realizar la solicitud a la API de WhatsApp
    const whatsappResponse = await fetch(whatsappApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": whatsappApiKey
      },
      body: JSON.stringify({
        phoneNumber: formattedPhoneNumber,
        messageBody: messageBody
      })
    })

    if (!whatsappResponse.ok) {
      const errorText = await whatsappResponse.text()
      console.error('[send-lyric-whatsapp] Error al enviar mensaje de WhatsApp:', errorText)
      return NextResponse.json(
        { 
          success: false, 
          error: `Error al enviar WhatsApp: ${whatsappResponse.status}`,
          details: errorText
        },
        { status: 500 }
      )
    }

    console.log('[send-lyric-whatsapp] ✓ Enviado exitosamente con legacy provider')

    return NextResponse.json({
      success: true,
      message: "Letra enviada por WhatsApp exitosamente",
      whatsapp: formattedPhoneNumber,
      orderId: order.id,
      provider: 'legacy',
      sentAt: new Date().toISOString()
    })

  } catch (error) {
    console.error("Error en send-lyric-whatsapp:", error)
    return NextResponse.json(
      {
        success: false,
        error: `Error interno del servidor: ${error instanceof Error ? error.message : String(error)}`
      },
      { status: 500 }
    )
  }
}
