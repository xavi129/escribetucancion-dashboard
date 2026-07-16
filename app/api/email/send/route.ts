import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { email, subject, message, whatsappLink } = await request.json()

    // Validar que se proporcionaron los datos necesarios
    if (!email || !subject || !message) {
      return NextResponse.json(
        { success: false, message: "Se requiere email, asunto y mensaje" },
        { status: 400 }
      )
    }

    // Obtener la API key de Resend desde las variables de entorno
    const resendApiKey = process.env.RESEND_API_KEY
    
    if (!resendApiKey) {
      console.error("Error: RESEND_API_KEY no está configurada en las variables de entorno")
      return NextResponse.json(
        { success: false, message: "Error de configuración del servidor" },
        { status: 500 }
      )
    }

    // Crear el HTML del correo con el enlace de WhatsApp si se proporciona
    let htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4a5568;">Escribe Tu Canción</h2>
        <p>${message}</p>
    `

    // Añadir el botón de WhatsApp si se proporciona un enlace
    if (whatsappLink) {
      htmlContent += `
        <div style="margin: 30px 0;">
          <a href="${whatsappLink}" target="_blank" style="background-color: #25D366; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Contactar por WhatsApp
          </a>
        </div>
      `
    }

    // Cerrar el HTML
    htmlContent += `
        <p style="color: #718096; font-size: 0.875rem; margin-top: 30px;">
          Este es un mensaje automático de Escribe Tu Canción.
        </p>
      </div>
    `

    // Configurar los datos para enviar a la API de Resend
    const data = {
      from: "Escribe Tu Canción <noreply@example.com>",
      to: email,
      subject: subject,
      html: htmlContent,
    }

    // Realizar la solicitud a la API de Resend
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`
      },
      body: JSON.stringify(data)
    })

    // Verificar la respuesta
    if (response.ok) {
      const responseData = await response.json()
      return NextResponse.json({ 
        success: true, 
        message: "Correo enviado correctamente",
        data: responseData
      })
    } else {
      const errorData = await response.text()
      console.error("Error al enviar correo con Resend:", errorData)
      return NextResponse.json(
        { success: false, message: "Error al enviar el correo" },
        { status: response.status }
      )
    }
  } catch (error) {
    console.error("Error en el endpoint de Email:", error)
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}