import { NextResponse } from "next/server"
import { sendSendPulseTemplate, isSendPulseEnabled } from "@/lib/sendpulse"
import { formatPhoneNumber } from "@/lib/phone-utils"

export async function POST(request: Request) {
  try {
    const { phoneNumber, param1, param2 } = await request.json()

    // Validar que se proporcionaron los datos necesarios
    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, message: "Se requiere número de teléfono" },
        { status: 400 }
      )
    }

    // Verificar si SendPulse está habilitado
    const useSendPulse = isSendPulseEnabled()
    
    if (!useSendPulse) {
      return NextResponse.json(
        { success: false, message: "SendPulse no está configurado" },
        { status: 500 }
      )
    }

    // Formatear el número de teléfono usando la utilidad internacional
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber)

    // Preparar los componentes de la plantilla
    const components: Array<{
      type: string
      parameters: Array<{
        type: string
        text: string
      }>
    }> = []

    // Si hay parámetros, agregarlos al body
    if (param1 || param2) {
      const bodyParams: Array<{ type: string; text: string }> = []
      
      if (param1) {
        bodyParams.push({
          type: "text",
          text: param1.substring(0, 30) // Limitar a 30 caracteres
        })
      }
      
      if (param2) {
        bodyParams.push({
          type: "text",
          text: param2.substring(0, 30) // Limitar a 30 caracteres
        })
      }

      if (bodyParams.length > 0) {
        components.push({
          type: "body",
          parameters: bodyParams
        })
      }
    }

    console.log('[SendPulse Marketing] Enviando plantilla shipment_confirmation_5 a', formattedPhoneNumber)
    console.log('[SendPulse Marketing] Parámetros:', { param1, param2 })

    // Enviar la plantilla con código de idioma es_MX específico para esta plantilla
    const result = await sendSendPulseTemplate(
      formattedPhoneNumber,
      "shipment_confirmation_5",
      components,
      "es_MX"
    )

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Plantilla de marketing enviada correctamente",
        messageId: result.messageId,
        provider: "sendpulse"
      })
    } else {
      console.error("Error al enviar plantilla de marketing:", result.error)
      return NextResponse.json(
        {
          success: false,
          message: "Error al enviar la plantilla de marketing",
          error: result.error
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Error al enviar plantilla de marketing:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Error al procesar la solicitud",
        error: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    )
  }
}

