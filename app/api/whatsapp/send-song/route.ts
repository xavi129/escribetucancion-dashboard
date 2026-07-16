import { NextResponse } from "next/server"
import { supabase, buildPlayUrl } from "@/lib/supabase"
import { sendSendPulseMessage, isSendPulseEnabled } from "@/lib/sendpulse"
import { getFirstName } from "@/lib/utils"
import { formatPhoneNumber } from "@/lib/phone-utils"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orderId, context } = body as { orderId?: string; context?: "create-new" | "replace-section" }

    if (!orderId) {
      return NextResponse.json(
        { success: false, message: "Se requiere el ID del pedido" },
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

    // Validar que tenga audio_url
    if (!order.audio_url) {
      return NextResponse.json(
        { success: false, message: "No hay canción generada para este pedido" },
        { status: 400 }
      )
    }

    // Detectar si hay múltiples versiones
    const hasMultipleVersions = !!(order.audio_url_alt && order.audio_url_alt.trim() !== "")

    // Construir el link según el estado de pago
    // Para previews, usar el ID de la orden en lugar de la URL completa del audio
    const playUrl = buildPlayUrl(order.audio_url, order.payment_status, order.id)

    if (!playUrl) {
      return NextResponse.json(
        { success: false, message: "Error al generar el link del reproductor" },
        { status: 500 }
      )
    }

    // Si hay múltiples versiones, construir también la URL de la segunda versión
    let playUrl2: string | null = null
    if (hasMultipleVersions && order.audio_url_alt) {
      // Para la segunda versión, usar un ID único (orderId-v2) para diferenciarla
      playUrl2 = buildPlayUrl(order.audio_url_alt, order.payment_status, `${order.id}-v2`)
    }

    // Formatear el número de teléfono usando la utilidad internacional
    const phoneNumber = formatPhoneNumber(order.whatsapp)

    // Crear mensaje personalizado según contexto, pago y si hay múltiples versiones
    let messageBody = ""

    // Caso: canción regenerada desde el front (create-new). Mensaje corto: nueva versión + original.
    if (context === "create-new" && hasMultipleVersions && playUrl2) {
      const previewNote = order.payment_status !== "paid" ? " (vista previa 70 s)" : ""
      messageBody = `¡Hola ${getFirstName(order.customer_name)}! 🎵\n\n` +
        `Aquí tienes la *nueva versión* de tu canción y también la *original*:\n\n` +
        `🆕 Nueva versión${previewNote}:\n${playUrl2}\n\n` +
        `📀 Original${previewNote}:\n${playUrl}\n\n` +
        `Con cariño,\n*EscribeTuCancion.com* 💝`
    } else if (context === "replace-section") {
      // Caso: sección reemplazada (replace-section). Mensaje corto.
      messageBody = `¡Hola ${getFirstName(order.customer_name)}! 🎵\n\n` +
        `Tu canción ha sido modificada. Escúchala aquí:\n${playUrl}\n\n` +
        `Con cariño,\n*EscribeTuCancion.com* 💝`
    } else if (hasMultipleVersions && playUrl2) {
      // Caso: plan con 2 versiones (generación inicial). Mensaje distinto al create-new.
      if (order.payment_status === "paid") {
        messageBody = `¡Hola ${getFirstName(order.customer_name)}! 🎉✨\n\n` +
          `¡Gracias por confiar en nosotros! 🎵 Tu canción está lista. Creamos *2 versiones* para que elijas la que más te guste:\n\n` +
          `🎶 *Versión 1:*\n${playUrl}\n\n` +
          `🎶 *Versión 2:*\n${playUrl2}\n\n` +
          `Con cariño,\n*EscribeTuCancion.com* 💝`
      } else {
        messageBody = `¡Hola ${getFirstName(order.customer_name)}! 🎵\n\n` +
          `Tu canción está lista. Preview (70 s) de cada versión:\n\n` +
          `🎶 *Versión 1:*\n${playUrl}\n\n` +
          `🎶 *Versión 2:*\n${playUrl2}\n\n` +
          `Confirma tu pago para recibir ambas completas. 💳\n\n` +
          `Con cariño,\n*EscribeTuCancion.com* 💝`
      }
    } else {
      // Una sola versión
      if (order.payment_status === "paid") {
        messageBody = `¡Hola ${getFirstName(order.customer_name)}! 🎵\n\n` +
          `Tu canción está lista. Escúchala aquí:\n${playUrl}\n\n` +
          `Con cariño,\n*EscribeTuCancion.com* 💝`
      } else {
        messageBody = `¡Hola ${getFirstName(order.customer_name)}! 🎵\n\n` +
          `Tu canción está lista. Preview (70 s):\n${playUrl}\n\n` +
          `Confirma tu pago para recibir la versión completa. 💳`
      }
    }

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
        console.log("[WhatsApp Send Song] Using SendPulse provider")
        const result = await sendSendPulseMessage(phoneNumber, body)
        return {
          success: result.success,
          error: result.error,
          messageId: result.messageId,
          provider: "sendpulse",
        }
      }

      console.log("[WhatsApp Send Song] Using legacy provider")

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
      console.error("Error al enviar mensaje principal de WhatsApp:", mainSendResult.error)
      return NextResponse.json(
        { success: false, message: "Error al enviar el mensaje", error: mainSendResult.error },
        { status: 500 }
      )
    }


    return NextResponse.json({
      success: true,
      message: "Canción enviada correctamente por WhatsApp",
      playUrl,
      playUrl2: playUrl2 || null,
      hasMultipleVersions,
      isPreview: order.payment_status !== "paid",
      messageId: mainSendResult.messageId,
      provider: mainSendResult.provider,
    })
  } catch (error) {
    console.error("Error en el endpoint de WhatsApp send-song:", error)
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
