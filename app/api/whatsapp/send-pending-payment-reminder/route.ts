import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { sendSendPulseMessage, isSendPulseEnabled } from "@/lib/sendpulse"
import { getFirstName } from "@/lib/utils"
import { formatPhoneNumber } from "@/lib/phone-utils"

/**
 * Endpoint para enviar recordatorios de pago pendiente
 * 
 * Este endpoint es llamado por el cron job de Supabase (check_pending_payment_reminders)
 * que crea jobs en pending_http_jobs cuando una orden tiene status 'pending_payment'
 * y han pasado más de 3 horas sin cambiar a 'completed'.
 * 
 * El mensaje es de marketing para aumentar la conversión, mencionando que los
 * servidores se limpian cada 24 horas (aunque es falso, solo para urgencia).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { whatsapp, customer_name, message, order_id } = body

    // Validar que se proporcionaron los datos necesarios
    if (!whatsapp || !order_id) {
      return NextResponse.json(
        { success: false, message: "Se requiere número de WhatsApp y order_id" },
        { status: 400 }
      )
    }

    // Obtener la orden para verificar que aún está en pending_payment
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: false, message: "Error de configuración del servidor" },
        { status: 500 }
      )
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single()

    if (orderError || !order) {
      console.error("[Pending Payment Reminder] Orden no encontrada:", order_id)
      return NextResponse.json(
        { success: false, message: "Orden no encontrada" },
        { status: 404 }
      )
    }

    // Verificar que la orden aún esté en pending_payment
    // Si ya cambió a completed, no enviar el recordatorio
    if (order.status !== "pending_payment") {
      console.log(
        `[Pending Payment Reminder] Orden ${order_id} ya no está en pending_payment (status: ${order.status}), omitiendo recordatorio`
      )
      return NextResponse.json({
        success: true,
        message: "Orden ya no está en pending_payment, recordatorio omitido",
        skipped: true,
      })
    }

    // Verificar que NUNCA se haya enviado un recordatorio para esta orden
    // Solo se permite UN recordatorio por orden
    if (order.pending_payment_reminder_sent_at) {
      console.log(
        `[Pending Payment Reminder] Ya se envió un recordatorio para orden ${order_id} el ${order.pending_payment_reminder_sent_at}, omitiendo (solo 1 recordatorio por orden)`
      )
      return NextResponse.json({
        success: true,
        message: "Recordatorio ya enviado anteriormente, omitiendo (solo 1 por orden)",
        skipped: true,
      })
    }

    // Formatear el número de teléfono usando la utilidad internacional
    const phoneNumber = formatPhoneNumber(whatsapp)

    // Usar el mensaje proporcionado o el mensaje por defecto
    const messageText =
      message ||
      `🎵 ¡Hola ${getFirstName(customer_name)}! Notamos que te quedaste a medias con tu canción. Recuerda que nuestros servidores se limpian automáticamente cada 24 horas para mantener la velocidad del sitio. Si no desbloqueas tu canción completa hoy, el archivo de audio que generaste se eliminará permanentemente y tendrías que empezar de cero. ¡Asegura tu canción ahora antes de que se borre! 💖`

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
        console.log("[Pending Payment Reminder] Using SendPulse provider")
        const result = await sendSendPulseMessage(phoneNumber, body)
        return {
          success: result.success,
          error: result.error,
          messageId: result.messageId,
          provider: "sendpulse",
        }
      }

      console.log("[Pending Payment Reminder] Using legacy provider")

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

    // Enviar el mensaje de recordatorio
    const sendResult = await sendWhatsAppMessage(messageText)

    if (!sendResult.success) {
      console.error(
        "[Pending Payment Reminder] Error al enviar mensaje:",
        sendResult.error
      )
      return NextResponse.json(
        {
          success: false,
          message: "Error al enviar el recordatorio",
          error: sendResult.error,
        },
        { status: 500 }
      )
    }

    // Actualizar el campo pending_payment_reminder_sent_at en la orden
    const now = new Date().toISOString()
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        pending_payment_reminder_sent_at: now,
        updated_at: now,
      })
      .eq("id", order_id)

    if (updateError) {
      console.error(
        "[Pending Payment Reminder] Error al actualizar pending_payment_reminder_sent_at:",
        updateError
      )
      // No retornar error aquí, el mensaje ya se envió exitosamente
    } else {
      console.log(
        `[Pending Payment Reminder] ✓ Recordatorio enviado y timestamp actualizado para orden ${order_id}`
      )
    }

    return NextResponse.json({
      success: true,
      message: "Recordatorio de pago pendiente enviado correctamente",
      order_id,
      messageId: sendResult.messageId,
      provider: sendResult.provider,
    })
  } catch (error) {
    console.error("[Pending Payment Reminder] Error en el endpoint:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Error interno del servidor",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

