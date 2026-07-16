import { NextResponse } from "next/server"
import { sendSendPulseMessage, isSendPulseEnabled } from "@/lib/sendpulse"
import { formatPhoneNumber } from "@/lib/phone-utils"

export async function POST(request: Request) {
  try {
    const { phoneNumber, messageBody } = await request.json()

    // Validar que se proporcionaron los datos necesarios
    if (!phoneNumber || !messageBody) {
      return NextResponse.json(
        { success: false, message: "Se requiere número de teléfono y mensaje" },
        { status: 400 }
      )
    }
    
    // Verificar si SendPulse está habilitado
    const useSendPulse = isSendPulseEnabled()
    
    if (useSendPulse) {
      console.log('[WhatsApp Send] Using SendPulse provider')
      // Usar SendPulse
      const result = await sendSendPulseMessage(phoneNumber, messageBody)
      
      if (result.success) {
        return NextResponse.json({ 
          success: true, 
          message: "Mensaje enviado correctamente",
          messageId: result.messageId,
          provider: 'sendpulse'
        })
      } else {
        console.error("Error al enviar mensaje con SendPulse:", result.error)
        return NextResponse.json(
          { success: false, message: "Error al enviar el mensaje", error: result.error },
          { status: 500 }
        )
      }
    }
    
    // Método antiguo (whatsapp-web.js o similar)
    console.log('[WhatsApp Send] Using legacy provider')
    const url = process.env.WHATSAPP_API_URL
    const apiKey = process.env.WHATSAPP_API_KEY
    
    if (!url || !apiKey) {
      console.error("Error: WHATSAPP_API_URL o WHATSAPP_API_KEY no están configuradas en las variables de entorno")
      return NextResponse.json(
        { success: false, message: "Error de configuración del servidor" },
        { status: 500 }
      )
    }

    // Formatear el número de teléfono usando la utilidad internacional
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber)
    console.log(`Número formateado: ${formattedPhoneNumber}`)
    
    // Datos para enviar a la API de WhatsApp
    const data = {
      phoneNumber: formattedPhoneNumber,
      messageBody
    }
    console.log("phoneNumber:", formattedPhoneNumber)
    // Realizar la solicitud a la API de WhatsApp (método legacy)
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify(data)
    })

    // Verificar la respuesta
    if (response.ok) {
      return NextResponse.json({ 
        success: true, 
        message: "Mensaje enviado correctamente",
        provider: 'legacy'
      })
    } else {
      const errorData = await response.text()
      console.error("Error al enviar mensaje de WhatsApp:", errorData)
      return NextResponse.json(
        { success: false, message: "Error al enviar el mensaje" },
        { status: response.status }
      )
    }
  } catch (error) {
    console.error("Error en el endpoint de WhatsApp:", error)
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}