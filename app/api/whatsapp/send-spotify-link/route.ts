import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { sendSendPulseMessage, isSendPulseEnabled } from "@/lib/sendpulse"
import { getFirstName } from "@/lib/utils"
import { formatPhoneNumber } from "@/lib/phone-utils"

export async function POST(request: Request) {
  try {
    const { orderId, hyperfollowUrl } = await request.json()

    if (!orderId) {
      return NextResponse.json(
        { success: false, message: "Se requiere el ID del pedido" },
        { status: 400 }
      )
    }

    if (!hyperfollowUrl) {
      return NextResponse.json(
        { success: false, message: "Se requiere el link de Hyperfollow" },
        { status: 400 }
      )
    }

    // Obtener la orden de la base de datos
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single()

    if (fetchError || !order) {
      return NextResponse.json(
        { success: false, message: "Pedido no encontrado" },
        { status: 404 }
      )
    }

    // Validar que tenga WhatsApp
    if (!order.whatsapp) {
      return NextResponse.json(
        { success: false, message: "Este cliente no tiene número de WhatsApp registrado" },
        { status: 400 }
      )
    }

    // Formatear el número de teléfono usando la utilidad internacional
    const phoneNumber = formatPhoneNumber(order.whatsapp)

    // Crear mensaje personalizado para Spotify/Hyperfollow
    const customerName = getFirstName(order.customer_name)
    const songName = order.spotify_song_name || "tu canción"
    
    const messageBody = `¡Hola ${customerName}! 🎉🎧\n\n` +
      `¡Excelentes noticias! Ya enviamos "${songName}" a las plataformas de streaming. 🚀\n\n` +
      `En este link puedes preguardar tu correo para que te avisemos cuando publiquen tu canción:\n${hyperfollowUrl}\n\n` +
      `⏰ Esto puede tomar de 1 a 2 días hábiles en estar disponible en Spotify, Apple Music y YouTube Music.\n\n` +
      `¡Gracias por confiar en nosotros! 💖\n\n` +
      `- Equipo EscribeTuCancion.com`

    const useSendPulse = isSendPulseEnabled()
    const legacyUrl = process.env.WHATSAPP_API_URL
    const legacyApiKey = process.env.WHATSAPP_API_KEY

    type SendResult = {
      success: boolean
      error?: string
      messageId?: string
      provider: "sendpulse" | "legacy"
    }

    const sendWhatsAppMessage = async (body: string): Promise<SendResult> => {
      if (useSendPulse) {
        console.log("[WhatsApp Send Spotify Link] Using SendPulse provider")
        const result = await sendSendPulseMessage(phoneNumber, body)
        return {
          success: result.success,
          error: result.error,
          messageId: result.messageId,
          provider: "sendpulse",
        }
      }

      console.log("[WhatsApp Send Spotify Link] Using legacy provider")

      if (!legacyUrl || !legacyApiKey) {
        return {
          success: false,
          error: "WHATSAPP_API_URL o WHATSAPP_API_KEY no configurados",
          provider: "legacy",
        }
      }

      const response = await fetch(legacyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": legacyApiKey,
        },
        body: JSON.stringify({ phoneNumber, messageBody: body }),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Error desconocido")
        return {
          success: false,
          error: errorText || "Error al enviar el mensaje por el proveedor legado",
          provider: "legacy",
        }
      }

      return { success: true, provider: "legacy" }
    }

    const mainSendResult = await sendWhatsAppMessage(messageBody)

    if (!mainSendResult.success) {
      console.error("Error al enviar mensaje de Spotify Link por WhatsApp:", mainSendResult.error)
      return NextResponse.json(
        { success: false, message: "Error al enviar el mensaje", error: mainSendResult.error },
        { status: 500 }
      )
    }

    // Actualizar la orden como completada y guardar el hyperfollow_url
    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "completed",
        hyperfollow_url: hyperfollowUrl,
        completed_at: now,
        updated_at: now,
      })
      .eq("id", orderId)

    if (updateError) {
      console.error("Error al actualizar orden:", updateError)
      // No fallamos la respuesta ya que el mensaje sí se envió
    }

    return NextResponse.json({
      success: true,
      message: "Link de Spotify enviado correctamente y orden completada",
      messageId: mainSendResult.messageId,
      provider: mainSendResult.provider,
    })
  } catch (error) {
    console.error("Error en el endpoint de WhatsApp send-spotify-link:", error)
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

