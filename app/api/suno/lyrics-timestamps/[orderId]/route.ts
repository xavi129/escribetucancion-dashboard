import { NextResponse } from "next/server"
import { supabase, supabaseAdmin } from "@/lib/supabase"
import { getTimestampedLyrics } from "@/lib/suno-api"

const db = supabaseAdmin ?? supabase

const ALLOWED_ORIGINS = [
  "https://play.escribetucancion.com",
  "https://dash.escribetucancion.com",
  "http://localhost",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
]

function addCorsHeaders(response: NextResponse, origin?: string | null): NextResponse {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
    response.headers.set("Access-Control-Allow-Credentials", "false")
  }
  return response
}

/** Preflight CORS */
export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin")
  return addCorsHeaders(new NextResponse(null, { status: 200 }), origin)
}

/**
 * GET /api/suno/lyrics-timestamps/:orderId
 *
 * Obtiene la letra sincronizada (timestamps) de Kie.ai para una orden.
 * Usa suno_task_id y suno_audio_id de la orden para llamar a get-timestamped-lyrics.
 *
 * Respuesta: data.alignedWords y data.waveformData (o la respuesta íntegra de Kie).
 *
 * Optimización opcional: cachear en DB (columna lyrics_timestamps en orders) o Redis.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const origin = request.headers.get("origin")

  try {
    const { orderId } = await params

    if (!orderId) {
      const res = NextResponse.json(
        { success: false, error: "orderId es requerido" },
        { status: 400 }
      )
      return addCorsHeaders(res, origin)
    }

    const { data: order, error: orderError } = await db
      .from("orders")
      .select("id, suno_task_id, suno_audio_id")
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      const res = NextResponse.json(
        { success: false, error: "Orden no encontrada" },
        { status: 404 }
      )
      return addCorsHeaders(res, origin)
    }

    const taskId = order.suno_task_id
    const audioId = order.suno_audio_id

    if (!taskId || !audioId) {
      const res = NextResponse.json(
        {
          success: false,
          error: "La orden no tiene suno_task_id o suno_audio_id (canción aún no generada o sin datos de Suno)",
        },
        { status: 400 }
      )
      return addCorsHeaders(res, origin)
    }

    const result = await getTimestampedLyrics(taskId, audioId)

    // Log para verificar en servidor que Kie devolvió datos (según docs: alignedWords, waveformData)
    const alignedWords = Array.isArray(result.data?.alignedWords) ? result.data.alignedWords : []
    const waveformData = Array.isArray(result.data?.waveformData) ? result.data.waveformData : []
    console.log("[lyrics-timestamps] Kie response:", {
      orderId,
      code: result.code,
      hasData: !!result.data,
      alignedWordsCount: alignedWords.length,
      waveformDataCount: waveformData.length,
      hootCer: (result.data as Record<string, unknown>)?.hootCer,
      isStreamed: (result.data as Record<string, unknown>)?.isStreamed,
    })

    if (result.code !== 200) {
      const res = NextResponse.json(
        {
          success: false,
          message: result.msg || "Error al obtener letra sincronizada",
          code: result.code,
          data: result.data ?? null,
        },
        { status: result.code >= 400 ? result.code : 500 }
      )
      return addCorsHeaders(res, origin)
    }

    // Respuesta según documentación Kie: data.alignedWords (word, success, startS, endS, palign), data.waveformData, data.hootCer, data.isStreamed
    const res = NextResponse.json({
      success: true,
      data: result.data ?? null,
      alignedWords: result.data?.alignedWords ?? null,
      waveformData: result.data?.waveformData ?? null,
    })
    return addCorsHeaders(res, origin)
  } catch (error) {
    console.error("[lyrics-timestamps] Error:", error)
    const res = NextResponse.json(
      {
        success: false,
        error: "Error al obtener letra sincronizada",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
    return addCorsHeaders(res, request.headers.get("origin"))
  }
}
