import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { generateTextWithFallback } from "@/lib/ai"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('[generate-and-save-lyric] Request body recibido:', JSON.stringify(body, null, 2))

    const { whatsapp, forceRegenerate, sendWhatsApp = false } = body

    console.log('[generate-and-save-lyric] Parámetros parseados:', {
      whatsapp,
      forceRegenerate,
      sendWhatsApp,
      sendWhatsAppType: typeof sendWhatsApp,
      bodyKeys: Object.keys(body)
    })

    if (!whatsapp) {
      return NextResponse.json({ success: false, message: "WhatsApp number is required" }, { status: 400 })
    }

    // Buscar el último registro con ese número de teléfono
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("whatsapp", whatsapp)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, message: "No order found for this WhatsApp number", details: orderError?.message },
        { status: 404 }
      )
    }

    // Si ya tiene letra y no se fuerza la regeneración, devolver la existente
    if (order.generated_lyric && !forceRegenerate) {
      return NextResponse.json({
        success: true,
        message: "Lyric already exists",
        data: {
          orderId: order.id,
          whatsapp: order.whatsapp,
          customerName: order.customer_name,
          lyric: order.generated_lyric,
          order: order,
          wasRegenerated: false,
        },
      })
    }

    // Construir el prompt para generar la letra
    let prompt = `Escribe letras para una canción ${order.song_type || "original"}`

    if (order.genre) {
      prompt += ` en el género ${order.genre}`
    }

    if (order.occasion) {
      prompt += ` para una ocasión de ${order.occasion}`
    }

    prompt += ".\n\n"

    if (order.include_name && order.person_name) {
      prompt += `Debe incluir el nombre "${order.person_name}"`
      if (order.relationship) {
        prompt += ` (${order.relationship})`
      }
      prompt += ".\n\n"
    }

    if (order.details) {
      prompt += `Detalles adicionales: ${order.details}\n\n`
    }

    if (order.song_references) {
      prompt += `Referencias de canciones: ${order.song_references}\n\n`
    }

    if (order.styles) {
      prompt += `Estilo musical: ${order.styles}\n\n`
    }

    // Verificar si al menos una API key está disponible
    const apiKey = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ success: false, message: "API configuration error" }, { status: 500 })
    }

    const enhancedPrompt = `Escribe letras de canciones en español basadas en los siguientes detalles:
${prompt}

INSTRUCCIONES CRÍTICAS:
- La respuesta debe contener ÚNICAMENTE la letra de la canción, sin ningún texto introductorio ni explicativo.
- Marca las secciones entre paréntesis simples como: (Intro), (Verso 1), (Verso 2), (Estribillo), (Puente), (Outro), etc.
- Usa SIEMPRE estos nombres exactos de secciones: (Intro), (Verso), (Estribillo), (Puente), (Outro)
- NO uses variaciones como "Introducción", "Coro", "Chorus", etc. - mantén los nombres estándar
- No incluyas ninguna explicación, comentario o nota adicional.
- No incluyas comillas ni otros caracteres especiales alrededor de la letra.
- La letra DEBE estar en español.
- Mantén el texto en menos de 400 palabras en total.

PROHIBICIONES ABSOLUTAS:
- NO uses dígitos numéricos (0-9). Escribe TODOS los números en letras (ejemplo: 'uno' en lugar de '1', 'mil novecientos noventa' en lugar de '1990').
- Esta regla de "no números" se aplica a TODO el contenido, incluso si el usuario proporcionó fechas o cantidades en números en los detalles.
- NUNCA menciones precios, costos, cantidades de dinero (como "199", "MXN", "pesos", "dólares", etc.).
- NUNCA menciones números relacionados con transacciones comerciales.
- NUNCA incluyas referencias a pagos, compras, o aspectos comerciales.
- NUNCA menciones códigos de referencia o identificadores de pedido.
- NUNCA incluyas información sobre métodos de entrega o plazos de envío.
- NUNCA menciones el género musical en la letra (como "bachata", "cumbia", "reggaeton", "corrido", "rap", "rock", etc.).
- En lugar de mencionar el género, usa palabras genéricas como "canción", "melodía", "música", "ritmo", etc.

ENFOQUE CORRECTO:
- Enfócate EXCLUSIVAMENTE en el contenido emocional y la historia personal.
- Usa los detalles proporcionados sobre la persona, la relación, y los sentimientos.
- Si la canción es "para ella" y se menciona una relación (como "mi mejor amiga"), esa relación se refiere a LA DESTINATARIA de la canción, no a una tercera persona.
- Crea una letra romántica, emotiva y personal que celebre la ocasión y los sentimientos descritos.
- El estilo musical se aplicará después, así que NO lo menciones en la letra.`

    // Llamar a la API con fallback
    const result = await generateTextWithFallback({
      prompt: enhancedPrompt,
      temperature: 0.7,
      maxOutputTokens: 2048,
    })

    let generatedText = result.text

    // Limpiar cualquier texto explicativo
    const firstSectionMatch = generatedText.match(/\([A-Za-zÀ-ÿ\s]+\)/)
    if (firstSectionMatch && firstSectionMatch.index !== undefined) {
      generatedText = generatedText.substring(firstSectionMatch.index)
    }

    console.log(`[generate-and-save-lyric] Generado con: ${result.provider}`)

    // Guardar la letra en la base de datos
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        generated_lyric: generatedText,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { success: false, message: "Error saving lyric to database", details: updateError.message },
        { status: 500 }
      )
    }

    // Enviar letra por WhatsApp automáticamente SOLO si viene del chatbot
    if (sendWhatsApp && whatsapp && generatedText) {
      console.log('[generate-and-save-lyric] sendWhatsApp está activo, enviando letra por WhatsApp...')
      console.log('[generate-and-save-lyric] Parámetros:', {
        whatsapp,
        orderId: updatedOrder.id,
        forceRegenerate,
        hasAdjustmentNote: !!forceRegenerate
      })

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3002}`
      const whatsappEndpoint = `${baseUrl}/api/orders/send-lyric-whatsapp`

      console.log('[generate-and-save-lyric] Llamando a:', whatsappEndpoint)

      try {
        const whatsappResponse = await fetch(whatsappEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            whatsapp,
            orderId: updatedOrder.id,
            adjustmentNote: forceRegenerate
              ? "He generado una nueva versión de tu letra según tus indicaciones:"
              : null
          })
        })

        const whatsappData = await whatsappResponse.json()

        if (whatsappResponse.ok) {
          console.log('[generate-and-save-lyric] Letra enviada por WhatsApp exitosamente:', whatsappData)
        } else {
          console.error('[generate-and-save-lyric] Error al enviar letra por WhatsApp:', {
            status: whatsappResponse.status,
            data: whatsappData
          })
        }
      } catch (err) {
        console.error('[generate-and-save-lyric] Excepción al enviar letra por WhatsApp:', err)
      }
    } else {
      console.log('[generate-and-save-lyric] No se enviará por WhatsApp:', {
        sendWhatsApp,
        hasWhatsApp: !!whatsapp,
        hasGeneratedText: !!generatedText
      })
    }

    return NextResponse.json({
      success: true,
      message: "Lyric generated and saved successfully",
      data: {
        orderId: updatedOrder.id,
        whatsapp: updatedOrder.whatsapp,
        customerName: updatedOrder.customer_name,
        lyric: generatedText,
        order: updatedOrder,
        wasRegenerated: forceRegenerate || false,
        provider: result.provider,
      },
    })
  } catch (error) {
    console.error("Error processing generate-and-save-lyric request:", error)
    return NextResponse.json(
      {
        success: false,
        message: `Internal server error: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}
