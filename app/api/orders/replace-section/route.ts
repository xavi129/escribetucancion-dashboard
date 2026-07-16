import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { replaceSongSection } from "@/lib/suno-api"

// Orígenes permitidos para CORS (play, dashboard, desarrollo)
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
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
    response.headers.set("Access-Control-Allow-Credentials", "false")
  }
  return response
}

function jsonCors(origin: string | null, data: object, init?: ResponseInit) {
  return addCorsHeaders(NextResponse.json(data, init), origin)
}

/**
 * Validates replace-section parameters according to Suno API restrictions
 * - Minimum duration: 6 seconds
 * - Maximum duration: 60 seconds
 * - Cannot exceed 50% of total song duration (if originalDuration provided)
 */
function validateReplaceSection(
  sectionStart: number,
  sectionEnd: number,
  originalDuration?: number
): { valid: boolean; error?: string } {
  const sectionDuration = sectionEnd - sectionStart

  if (sectionStart >= sectionEnd) {
    return { valid: false, error: "El tiempo de inicio debe ser menor que el tiempo de fin" }
  }

  if (sectionDuration < 6) {
    return { valid: false, error: "La sección debe tener al menos 6 segundos" }
  }

  if (sectionDuration > 60) {
    return { valid: false, error: "La sección no puede exceder 60 segundos" }
  }

  if (originalDuration && sectionDuration > originalDuration * 0.5) {
    return { valid: false, error: "La sección no puede exceder el 50% de la duración total de la canción" }
  }

  return { valid: true }
}

/** Preflight CORS: el navegador envía OPTIONS antes de POST cross-origin */
export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin")
  const response = new NextResponse(null, { status: 200 })
  return addCorsHeaders(response, origin)
}

/**
 * POST /api/orders/replace-section
 *
 * Endpoint público para iniciar una operación de replace-section en Suno API.
 * Permite a usuarios que ya pagaron modificar secciones específicas de sus canciones.
 *
 * Este endpoint puede ser llamado desde play.escribetucancion.com o desde el dashboard.
 *
 * Body:
 * - orderId: UUID de la orden
 * - prompt: Texto describiendo los cambios deseados
 * - sectionStart: Número (tiempo en segundos donde inicia la sección)
 * - sectionEnd: Número (tiempo en segundos donde termina la sección)
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin")

  try {
    const body = await request.json()
    const { orderId, prompt, sectionStart, sectionEnd } = body

    // Validar campos requeridos
    if (!orderId) {
      return jsonCors(origin, { success: false, error: "orderId is required" }, { status: 400 })
    }

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return jsonCors(
        origin,
        { success: false, error: "prompt is required and must be a valid description" },
        { status: 400 }
      )
    }

    if (sectionStart === undefined || sectionEnd === undefined) {
      return jsonCors(
        origin,
        { success: false, error: "sectionStart and sectionEnd are required" },
        { status: 400 }
      )
    }

    if (typeof sectionStart !== "number" || typeof sectionEnd !== "number") {
      return jsonCors(
        origin,
        { success: false, error: "sectionStart and sectionEnd must be numbers" },
        { status: 400 }
      )
    }

    if (sectionStart < 0) {
      return jsonCors(
        origin,
        { success: false, error: "sectionStart cannot be negative" },
        { status: 400 }
      )
    }

    if (sectionEnd <= sectionStart) {
      return jsonCors(
        origin,
        { success: false, error: "sectionEnd must be greater than sectionStart" },
        { status: 400 }
      )
    }

    // Buscar la orden
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      console.error("[Replace Section] Order not found:", orderId, orderError)
      return jsonCors(origin, { success: false, error: "Order not found" }, { status: 404 })
    }

    // Validar que la orden esté pagada
    if (order.payment_status !== "paid") {
      return jsonCors(origin, { success: false, error: "Payment required" }, { status: 403 })
    }

    // Validar limite de ediciones (1 gratuita por orden)
    const editsUsed = (order as { edits_used?: number }).edits_used ?? 0
    if (editsUsed >= 1) {
      return jsonCors(origin, {
        success: false,
        error: "Ya has utilizado tu edición gratuita incluida.",
        code: "EDIT_LIMIT_REACHED",
        editsUsed,
      }, { status: 403 })
    }

    // Validar que exista el audio_url
    if (!order.audio_url) {
      return jsonCors(
        origin,
        { success: false, error: "Order has no generated song" },
        { status: 400 }
      )
    }

    // Validar que exista el suno_audio_id
    if (!order.suno_audio_id) {
      return jsonCors(
        origin,
        { success: false, error: "Audio ID not found" },
        { status: 400 }
      )
    }

    // Validar que exista suno_task_id (requerido por la API)
    if (!order.suno_task_id) {
      return jsonCors(
        origin,
        {
          success: false,
          error: "Task ID not found. The order must have a Suno task ID from the original generation.",
        },
        { status: 400 }
      )
    }

    // Parámetros requeridos por la API: taskId, tags, title (obtenidos de la orden)
    const taskId = order.suno_task_id
    const audioId = order.suno_audio_id
    const tags = order.genre || order.styles || "pop"
    const title = order.person_name ? `Canción para ${order.person_name}` : "Mi Canción"
    const infillStartS = parseFloat(Number(sectionStart).toFixed(2))
    const infillEndS = parseFloat(Number(sectionEnd).toFixed(2))

    // Validar restricciones de la API Suno (duración 6–60 s, máx 50% del total si aplica)
    const originalDuration = (order as { duration?: number }).duration
    const validation = validateReplaceSection(infillStartS, infillEndS, originalDuration)
    if (!validation.valid) {
      return jsonCors(origin, { success: false, error: validation.error }, { status: 400 })
    }

    // Construir la URL del callback
    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    if (!baseUrl) {
      const host = request.headers.get("host")
      const protocol = request.headers.get("x-forwarded-proto") || "https"
      if (host) {
        baseUrl = `${protocol}://${host}`
      } else {
        baseUrl = `http://localhost:${process.env.PORT || 3000}`
      }
    }

    const callBackUrl = `${baseUrl}/api/webhook/suno?orderId=${orderId}&type=replace-section`

    console.log("[Replace Section] Starting operation:", {
      orderId,
      taskId,
      audioId,
      infillStartS,
      infillEndS,
      prompt: prompt.substring(0, 100) + "...",
      tags,
      title,
      callBackUrl,
    })

    // Llamar a la función de Suno API (parámetros según documentación oficial)
    const result = await replaceSongSection(
      taskId,
      audioId,
      prompt.trim(),
      tags,
      title,
      infillStartS,
      infillEndS,
      undefined, // negativeTags opcional
      undefined, // fullLyrics opcional
      callBackUrl
    )

    console.log("[Replace Section] Suno API response:", result)

    // Verificar el resultado
    if (result.code !== 200) {
      console.error("[Replace Section] Suno API error:", result)
      return jsonCors(origin, {
        success: false,
        error: result.msg || "Error starting replace section operation",
      }, { status: 500 })
    }

    // Extraer el taskId del resultado (ID de la tarea de replace para consultar estado)
    const replaceTaskId = (result.data as any)?.taskId || (result.data as any)?.task_id

    // Actualizar la orden para indicar que hay una modificación en progreso
    await supabase
      .from("orders")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    console.log("[Replace Section] Operation started successfully:", {
      orderId,
      replaceTaskId,
    })

    return jsonCors(origin, {
      success: true,
      taskId: replaceTaskId,
      message: "Replace section operation started. You will be notified when it's ready.",
    })
  } catch (error) {
    console.error("[Replace Section] Error:", error)
    return jsonCors(origin, {
      success: false,
      error: "Internal server error",
    }, { status: 500 })
  }
}
