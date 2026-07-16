import { NextResponse } from "next/server"
import { supabase, supabaseAdmin } from "@/lib/supabase"
import { generateCustomMusic, SunoModel } from "@/lib/suno-api"

function normalizeGender(gender: string | null | undefined): string | undefined {
  if (!gender) return undefined
  const g = gender.toLowerCase().trim()
  if (['m', 'male', 'hombre', 'masculino'].includes(g)) return 'm'
  if (['f', 'female', 'mujer', 'femenino'].includes(g)) return 'f'
  return undefined
}

/**
 * Endpoint para generar una canción usando Suno API
 * Requiere que la orden tenga una letra generada (generated_lyric)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orderId, whatsapp, style, title, model } = body

    if (!orderId && !whatsapp) {
      return NextResponse.json(
        { success: false, error: "Se requiere orderId o whatsapp" },
        { status: 400 }
      )
    }

    // Buscar la orden (usar supabaseAdmin para tener acceso completo)
    const supabaseClient = supabaseAdmin || supabase
    let query = supabaseClient.from("orders").select("*")

    if (orderId) {
      query = query.eq("id", orderId)
    } else if (whatsapp) {
      query = query.eq("whatsapp", whatsapp).order("created_at", { ascending: false }).limit(1)
    }

    const { data: order, error: orderError } = await query.single()

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: "No se encontró la orden", details: orderError?.message },
        { status: 404 }
      )
    }

    // Validar que tenga letra generada
    if (!order.generated_lyric || order.generated_lyric.trim() === "") {
      return NextResponse.json(
        { success: false, error: "La orden no tiene letra generada. Genera la letra primero." },
        { status: 400 }
      )
    }

    // Validar que no tenga ya una canción generada (a menos que se fuerce regeneración)
    if (order.audio_url && !body.forceRegenerate) {
      return NextResponse.json({
        success: true,
        message: "La canción ya está generada",
        data: {
          orderId: order.id,
          audioUrl: order.audio_url,
          existing: true,
        },
      })
    }

    // Obtener o generar el estilo musical
    let finalStyle = style
    
    // Si no se proporcionó un estilo explícito, intentar recuperar o generar uno
    if (!finalStyle && order.id) {
      // Primero verificar si hay un estilo generado guardado
      if (order.generated_style && order.generated_style.trim().length > 0) {
        finalStyle = order.generated_style
        console.log('[generate-song] Usando estilo generado guardado:', finalStyle)
      } else {
        // Si no hay estilo generado, intentar generarlo usando el endpoint de Gemini
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
          
          // Construir combinedStyle a partir de los datos de la orden
          let combinedStyle = ""
          if (order.song_references && order.styles) {
            // Asegurar que styles sea string
            const stylesStr = Array.isArray(order.styles) ? order.styles.join(", ") : order.styles
            combinedStyle = `${stylesStr}, ${order.song_references}`
          } else if (order.styles) {
            combinedStyle = Array.isArray(order.styles) ? order.styles.join(", ") : order.styles
          } else if (order.song_references) {
            combinedStyle = order.song_references
          }

          // Limpiar referencias a artistas
          if (combinedStyle) {
            combinedStyle = combinedStyle
              .replace(/(por|de|interpretada por|interpretado por)\s+[^,;]+/gi, "")
              .replace(/\s+,/g, ",")
              .trim()
          }

          // Si hay información suficiente, generar el estilo
          if (combinedStyle && combinedStyle.length >= 3) {
            console.log('[generate-song] Enviando a generate-style:')
            console.log('  - genre:', order.genre)
            console.log('  - combinedStyle:', combinedStyle)
            console.log('  - song_references:', order.song_references)
            console.log('  - styles:', order.styles)
            
            const generateStyleResponse = await fetch(`${baseUrl}/api/gemini/generate-style`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                combinedStyle,
                orderId: order.id,
                lyrics: order.generated_lyric,
                genre: order.genre,
                purpose: order.purpose,
                occasion: order.occasion,
                voice_gender: order.voice_gender,
              }),
            })

            if (generateStyleResponse.ok) {
              const styleData = await generateStyleResponse.json()
              if (styleData.success && styleData.style) {
                finalStyle = styleData.style
                console.log('[generate-song] Estilo generado exitosamente:', finalStyle)
              }
            }
          }
        } catch (error) {
          console.error('[generate-song] Error al generar estilo:', error)
        }
      }
    }

    // Si aún no hay estilo, usar el estilo de la orden o un valor por defecto
    if (!finalStyle) {
      finalStyle = order.styles || "Pop"
      console.log('[generate-song] Usando estilo por defecto:', finalStyle)
    }

    const sunoStyle = finalStyle
    const sunoTitle = title || order.customer_name || "Mi Canción"
    const sunoModel = (model as SunoModel) || "V5"
    const vocalGender = normalizeGender(order.voice_gender)

    // Construir callback URL para recibir notificación cuando esté lista
    // Incluimos el orderId como parámetro para asociar el callback con la orden
    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    
    if (!baseUrl) {
      // Intentar obtener desde headers de la request (Next.js/Vercel)
      const host = request.headers.get("host")
      const protocol = request.headers.get("x-forwarded-proto") || "https"
      if (host) {
        baseUrl = `${protocol}://${host}`
      } else {
        // Fallback para desarrollo local
        baseUrl = `http://localhost:${process.env.PORT || 3000}`
      }
    }
    
    const callbackUrl = `${baseUrl}/api/webhook/suno?orderId=${order.id}`

    console.log('[generate-song] Iniciando generación de canción:', {
      orderId: order.id,
      hasLyric: !!order.generated_lyric,
      style: sunoStyle,
      title: sunoTitle,
      model: sunoModel,
      vocalGender,
      callbackUrl,
    })

    // Actualizar estado de la orden a "generating"
    await supabaseClient
      .from("orders")
      .update({
        status: "generating",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)

    // Generar la canción con Suno
    const result = await generateCustomMusic({
      lyric: order.generated_lyric,
      style: sunoStyle,
      title: sunoTitle,
      model: sunoModel,
      vocalGender,
      callBackUrl: callbackUrl,
    })

    if (result.code !== 200) {
      // Si falla, revertir el estado
      await supabaseClient
        .from("orders")
        .update({
          status: order.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)

      return NextResponse.json(
        {
          success: false,
          error: result.msg || "Error al generar la canción",
          details: result,
        },
        { status: 500 }
      )
    }

    // Extraer taskId de la respuesta
    const taskId = (result.data as any)?.taskId || (result.data as any)?.data?.taskId

    if (!taskId) {
      return NextResponse.json(
        {
          success: false,
          error: "No se recibió taskId de Suno API",
          details: result,
        },
        { status: 500 }
      )
    }

    // Guardar el taskId en la orden (necesitarás agregar este campo a la tabla)
    // Por ahora, lo guardaremos en un campo temporal o lo manejaremos en el webhook
    console.log('[generate-song] Canción en proceso:', {
      orderId: order.id,
      taskId,
    })

    return NextResponse.json({
      success: true,
      message: "Generación de canción iniciada",
      data: {
        orderId: order.id,
        taskId,
        status: "generating",
        estimatedTime: "2-5 minutos",
      },
    })
  } catch (error) {
    console.error("Error en generate-song:", error)
    return NextResponse.json(
      {
        success: false,
        error: `Error interno del servidor: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}
