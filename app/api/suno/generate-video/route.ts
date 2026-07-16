import { NextResponse } from "next/server"
import { supabase, supabaseAdmin } from "@/lib/supabase"
import { createMusicVideo } from "@/lib/suno-api"

/**
 * Endpoint para generar un video musical usando Suno API
 * Requiere que la orden tenga audio_url (canción generada)
 * Documentation: https://docs.kie.ai/suno-api/create-music-video
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orderId, taskId, audioId } = body

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Se requiere orderId" },
        { status: 400 }
      )
    }

    // Buscar la orden (usar supabaseAdmin para tener acceso completo)
    const supabaseClient = supabaseAdmin || supabase
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: "No se encontró la orden", details: orderError?.message },
        { status: 404 }
      )
    }

    // Validar que tenga audio_url (requisito para generar video)
    if (!order.audio_url || order.audio_url.trim() === "") {
      return NextResponse.json(
        { success: false, error: "La orden no tiene canción generada. Genera la canción primero." },
        { status: 400 }
      )
    }

    // Validar que no tenga ya un video generado (a menos que se fuerce regeneración)
    if (order.video_url && !body.forceRegenerate) {
      return NextResponse.json({
        success: true,
        message: "El video ya está generado",
        data: {
          orderId: order.id,
          videoUrl: order.video_url,
          existing: true,
        },
      })
    }

    // Extraer taskId y audioId
    // Primero intentar obtenerlos de la orden (si fueron guardados en el callback de audio)
    // Si no están en la orden, usar los proporcionados como parámetros
    let finalTaskId = order.suno_task_id || taskId
    let finalAudioId = order.suno_audio_id || audioId

    // Si aún no tenemos los valores, requerirlos como parámetros
    if (!finalTaskId || !finalAudioId) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Se requieren taskId y audioId. Estos valores se guardan automáticamente cuando se genera el audio mediante Suno API. Si la orden fue creada antes de esta actualización, proporciona estos valores manualmente:\n\n- taskId: El taskId de la generación de audio original\n- audioId: El ID del track (track.id) que viene en el callback de audio" 
        },
        { status: 400 }
      )
    }

    // Construir callback URL para recibir notificación cuando el video esté listo
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
    
    const callbackUrl = `${baseUrl}/api/webhook/suno?orderId=${order.id}&type=video`

    console.log('[generate-video] Iniciando generación de video:', {
      orderId: order.id,
      taskId: finalTaskId,
      audioId: finalAudioId,
      hasAudioUrl: !!order.audio_url,
      callbackUrl,
    })

    // Actualizar estado de la orden (opcional: agregar estado "generating_video")
    await supabaseClient
      .from("orders")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)

    // Generar el video con Suno
    const result = await createMusicVideo(
      finalTaskId,
      finalAudioId,
      callbackUrl
    )

    if (result.code !== 200) {
      return NextResponse.json(
        {
          success: false,
          error: result.msg || "Error al generar el video",
          details: result,
        },
        { status: 500 }
      )
    }

    // Extraer taskId del video de la respuesta
    const videoTaskId = result.data?.taskId || result.data?.task_id

    if (!videoTaskId) {
      return NextResponse.json(
        {
          success: false,
          error: "No se recibió taskId de Suno API para el video",
          details: result,
        },
        { status: 500 }
      )
    }

    console.log('[generate-video] Video en proceso:', {
      orderId: order.id,
      videoTaskId,
    })

    return NextResponse.json({
      success: true,
      message: "Generación de video iniciada",
      data: {
        orderId: order.id,
        taskId: videoTaskId,
        status: "generating",
        estimatedTime: "5-10 minutos",
      },
    })
  } catch (error) {
    console.error("Error en generate-video:", error)
    return NextResponse.json(
      {
        success: false,
        error: `Error interno del servidor: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
  }
}

