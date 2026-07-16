import { NextResponse } from "next/server"
import { sendSendPulseInteractiveButtons, isSendPulseEnabled } from "@/lib/sendpulse"
import { formatPhoneNumber } from "@/lib/phone-utils"

type ExpressUpsellPayload = {
  whatsapp: string
  order_id: string
  message: string
}

export async function POST(request: Request) {
  try {
    const payload: ExpressUpsellPayload = await request.json()
    const { whatsapp, order_id, message } = payload

    if (!whatsapp || !order_id || !message) {
      return NextResponse.json(
        { success: false, message: "Se requiere whatsapp, order_id y message" },
        { status: 400 }
      )
    }

    const phoneNumber = formatPhoneNumber(whatsapp)

    const useSendPulse = isSendPulseEnabled()
    const legacyUrl = process.env.WHATSAPP_API_URL
    const legacyApiKey = process.env.WHATSAPP_API_KEY

    if (!useSendPulse && (!legacyUrl || !legacyApiKey)) {
      console.error("[Express Upsell] Faltan credenciales del proveedor legacy")
      return NextResponse.json(
        { success: false, message: "Proveedor de WhatsApp no configurado" },
        { status: 500 }
      )
    }

    const sendResult = useSendPulse
      ? await sendSendPulseInteractiveButtons(
          phoneNumber,
          message,
          [
            { id: "activar express", title: "Activar express" },
            { id: "no gracias", title: "No, gracias" },
          ]
        )
      : await fetch(legacyUrl!, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": legacyApiKey!,
          },
          body: JSON.stringify({
            phoneNumber,
            messageBody: message,
          }),
        }).then(async (response) => {
          if (!response.ok) {
            const errorText = await response.text().catch(() => "Error desconocido")
            return { success: false, error: errorText }
          }
          return { success: true }
        })

    if (!sendResult.success) {
      console.error("[Express Upsell] Error al enviar mensaje:", sendResult.error)
      return NextResponse.json(
        {
          success: false,
          message: "Error al enviar mensaje de upsell express",
          error: sendResult.error,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Upsell express enviado correctamente",
      order_id,
      provider: useSendPulse ? "sendpulse" : "legacy",
      interactive: useSendPulse,
    })
  } catch (error) {
    console.error("[Express Upsell] Error en el endpoint:", error)
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

