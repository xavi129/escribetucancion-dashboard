import { NextResponse } from "next/server"
import { supabase, supabaseAdmin } from "@/lib/supabase"
import { generateTextWithFallback } from "@/lib/ai"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('[edit-lyric] Request body recibido:', JSON.stringify(body, null, 2))

    const { whatsapp, orderId, editInstructions, sendWhatsApp = false } = body

    if (!whatsapp && !orderId) {
      return NextResponse.json({
        success: false,
        message: "WhatsApp number or orderId is required"
      }, { status: 400 })
    }

    if (!editInstructions || editInstructions.trim() === '') {
      return NextResponse.json({
        success: false,
        message: "Edit instructions are required"
      }, { status: 400 })
    }

    // Buscar la orden por orderId o por whatsapp
    const dbClient = supabaseAdmin || supabase
    let order = null
    let orderError = null

    if (orderId) {
      // Buscar por orderId directamente
      const result = await dbClient
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single()
      order = result.data
      orderError = result.error
    } else {
      // Buscar el último registro con ese número de teléfono
      const result = await dbClient
        .from("orders")
        .select("*")
        .eq("whatsapp", whatsapp)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()
      order = result.data
      orderError = result.error
    }

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, message: "No order found for this WhatsApp number", details: orderError?.message },
        { status: 404 }
      )
    }

    // Verificar que existe una letra para editar
    if (!order.generated_lyric || order.generated_lyric.trim() === '') {
      return NextResponse.json(
        { success: false, message: "No lyric found to edit. Please generate a lyric first." },
        { status: 400 }
      )
    }

    const currentLyric = order.generated_lyric
    console.log('[edit-lyric] Current lyric length:', currentLyric.length)
    console.log('[edit-lyric] Edit instructions:', editInstructions)

    // Verificar límite de revisiones (similar a generate-and-save-lyric)
    const details = order.details?.toLowerCase() || ''
    const deliveryType = order.delivery_type?.toLowerCase() || ''
    const songType = order.song_type?.toLowerCase() || ''
    let plan = 'estandar'
    let maxRevisions = 999

    if (details.includes('lite') || deliveryType.includes('lite') || songType.includes('lite')) {
      plan = 'lite'
      maxRevisions = 5
    } else if (details.includes('premium') || deliveryType.includes('premium') || songType.includes('premium')) {
      plan = 'premium'
      maxRevisions = 999
    }

    const currentRevisions = order.lyric_revision_count || 0

    if (plan === 'lite' && currentRevisions >= maxRevisions) {
      return NextResponse.json({
        success: false,
        message: `Has alcanzado el límite de ${maxRevisions} revisiones de letra para el Plan Lite. Si necesitas más cambios, considera actualizar a un plan superior con revisiones ilimitadas.`,
        limitReached: true,
        plan: plan,
        revisionsUsed: currentRevisions,
        maxRevisions: maxRevisions
      }, { status: 400 })
    }

    // Verificar si al menos una API key está disponible
    const apiKey = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        message: "API configuration error"
      }, { status: 500 })
    }

    // Build prompt for editing the lyric
    const editPrompt = `Tienes la siguiente letra de canción:

${currentLyric}

El cliente quiere hacer las siguientes modificaciones:
${editInstructions}

INSTRUCCIONES:
- Modifica la letra según las indicaciones del cliente.
- Mantén la estructura de la canción (Versos, Estribillos, Puentes, etc.).
- Conserva el estilo y tono general de la letra original.
- Asegúrate de que la letra modificada tenga sentido y fluya bien.
- La respuesta debe contener ÚNICAMENTE la letra modificada, sin ningún texto introductorio ni explicativo.
- Mantén las marcas de sección entre paréntesis simples como: (Verso), (Estribillo), (Puente), etc.
- No incluyas ninguna explicación, comentario o nota adicional.
- No incluyas comillas ni otros caracteres especiales alrededor de la letra.
- La letra DEBE estar en español.
- Mantén el texto en menos de 400 palabras en total.
- NUNCA menciones el género musical en la letra (como "bachata", "cumbia", "reggaeton", "corrido", "rap", "rock", etc.).
- En lugar de mencionar el género, usa palabras genéricas como "canción", "melodía", "música", "ritmo", etc.
- El estilo musical se aplicará después, así que NO lo menciones en la letra.`

    console.log('[edit-lyric] Calling AI API for lyric editing...')

    // Llamar a la API con fallback
    const result = await generateTextWithFallback({
      prompt: editPrompt,
      temperature: 0.7,
      maxOutputTokens: 2048,
    })

    let editedLyric = result.text || ''

    console.log(`[edit-lyric] Generado con: ${result.provider}`)

    // Clean any explanatory text
    const firstSectionMatch = editedLyric.match(/\([A-Za-zÀ-ÿ\s]+\)/)
    if (firstSectionMatch && firstSectionMatch.index !== undefined) {
      editedLyric = editedLyric.substring(firstSectionMatch.index)
    }

    if (!editedLyric || editedLyric.trim() === '') {
      console.error('[edit-lyric] Empty edited lyric received')
      return NextResponse.json(
        { success: false, message: 'No se pudo generar la letra editada. Por favor intenta de nuevo con instrucciones más específicas.' },
        { status: 500 }
      )
    }

    console.log('[edit-lyric] Edited lyric generated, length:', editedLyric.length)

    // Actualizar contador de revisiones
    const newRevisionCount = currentRevisions + 1

    // Save the edited lyric to database
    const { data: updatedOrder, error: updateError } = await dbClient
      .from("orders")
      .update({
        generated_lyric: editedLyric,
        lyric_revision_count: newRevisionCount,
        updated_at: new Date().toISOString()
      })
      .eq("id", order.id)
      .select()
      .single()

    if (updateError) {
      console.error('[edit-lyric] Error saving edited lyric:', updateError)
      return NextResponse.json(
        { success: false, message: "Error saving lyric to database", details: updateError.message },
        { status: 500 }
      )
    }

    console.log('[edit-lyric] Edited lyric saved successfully, revision count:', newRevisionCount)

    // Enviar letra por WhatsApp automáticamente si se solicita
    if (sendWhatsApp && whatsapp && editedLyric) {
      console.log('[edit-lyric] sendWhatsApp está activo, enviando letra editada por WhatsApp...')

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3002}`
      const whatsappEndpoint = `${baseUrl}/api/orders/send-lyric-whatsapp`

      console.log('[edit-lyric] Llamando a:', whatsappEndpoint)

      try {
        const whatsappResponse = await fetch(whatsappEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            whatsapp,
            orderId: updatedOrder.id,
            adjustmentNote: "He generado una nueva versión de tu letra según tus indicaciones:"
          })
        })

        const whatsappData = await whatsappResponse.json()

        if (whatsappResponse.ok) {
          console.log('[edit-lyric] Letra editada enviada por WhatsApp exitosamente:', whatsappData)
        } else {
          console.error('[edit-lyric] Error al enviar letra editada por WhatsApp:', {
            status: whatsappResponse.status,
            data: whatsappData
          })
        }
      } catch (err) {
        console.error('[edit-lyric] Excepción al enviar letra editada por WhatsApp:', err)
      }
    } else {
      console.log('[edit-lyric] No se enviará por WhatsApp:', {
        sendWhatsApp,
        hasWhatsApp: !!whatsapp,
        hasEditedLyric: !!editedLyric
      })
    }

    const revisionsRemaining = plan === 'lite' ? maxRevisions - newRevisionCount : 999

    return NextResponse.json({
      success: true,
      message: "Lyric edited and saved successfully",
      data: {
        orderId: updatedOrder.id,
        whatsapp: updatedOrder.whatsapp,
        customerName: updatedOrder.customer_name,
        lyric: editedLyric,
        order: updatedOrder,
        wasEdited: true,
        plan: plan,
        revisionsUsed: newRevisionCount,
        revisionsRemaining: revisionsRemaining,
        maxRevisions: maxRevisions,
        provider: result.provider,
      },
    })
  } catch (error) {
    console.error("Error processing edit-lyric request:", error)
    return NextResponse.json(
      {
        success: false,
        message: `Internal server error: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}
