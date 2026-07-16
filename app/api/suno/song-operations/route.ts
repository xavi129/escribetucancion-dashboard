import { NextResponse } from "next/server"
import {
  extendSong,
  getConcatenatedSong,
  coverSong,
  replaceSongSection,
  separateVocalsAndInstrumental,
  generateCustomMusic,
} from "@/lib/suno-api"
import { supabase, supabaseAdmin } from "@/lib/supabase"

// Cliente DB: admin en servidor (bypass RLS), anon como fallback
const db = supabaseAdmin ?? supabase

// Orígenes permitidos para CORS (desarrollo + producción)
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
 * - Cannot exceed 50% of total song duration
 */
function validateReplaceSection(
  sectionStart: number,
  sectionEnd: number,
  originalDuration?: number
): { valid: boolean; error?: string } {
  const sectionDuration = sectionEnd - sectionStart

  // Validate that start < end
  if (sectionStart >= sectionEnd) {
    return { valid: false, error: "El tiempo de inicio debe ser menor que el tiempo de fin" }
  }

  // Validate minimum duration (6 seconds)
  if (sectionDuration < 6) {
    return { valid: false, error: "La sección debe tener al menos 6 segundos" }
  }

  // Validate maximum duration (60 seconds)
  if (sectionDuration > 60) {
    return { valid: false, error: "La sección no puede exceder 60 segundos" }
  }

  // Validate that it doesn't exceed 50% of total duration (if known)
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

export async function POST(request: Request) {
  const origin = request.headers.get("origin")

  try {
    const body = await request.json()
    const { operation } = body

    if (!operation) {
      return jsonCors(origin, { success: false, message: "Operation type is required" }, { status: 400 })
    }

    let result

    // Handle different operations
    switch (operation) {
      // ============================================
      // CREATE-NEW: Generate a completely new song
      // ============================================
      case "create-new": {
        const { orderId, lyrics, fullLyrics, style, mood, occasion, details, modifications, personName, songType, model } = body
        // Aceptar lyrics o fullLyrics (el front puede enviar cualquiera)
        const lyricText = lyrics ?? fullLyrics

        if (!orderId) {
          return jsonCors(origin, { success: false, message: "orderId is required for create-new operation" }, { status: 400 })
        }

        if (!lyricText || String(lyricText).trim() === "") {
          return jsonCors(origin, { success: false, message: "lyrics or fullLyrics is required for create-new operation" }, { status: 400 })
        }

        // Verify order exists and is paid
        const { data: order, error: orderError } = await db
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single()

        if (orderError || !order) {
          return jsonCors(origin, { success: false, message: "Order not found" }, { status: 404 })
        }

        if (order.payment_status !== "paid") {
          return jsonCors(origin, { success: false, message: "Order must be paid to create a new song" }, { status: 403 })
        }

        // Validar limite de ediciones (1 gratuita por orden)
        const editsUsed = (order as { edits_used?: number }).edits_used ?? 0
        if (editsUsed >= 1) {
          return jsonCors(origin, {
            success: false,
            message: "Ya has utilizado tu edición gratuita incluida.",
            code: "EDIT_LIMIT_REACHED",
            editsUsed,
          }, { status: 403 })
        }

        // Build style string from various inputs (style puede ser string o array desde el front)
        const styleRaw = style ?? order.styles ?? order.genre
        const styleStr = Array.isArray(styleRaw) ? styleRaw.join(", ") : (styleRaw != null ? String(styleRaw) : "")
        const styleComponents = [
          styleStr,
          mood || order.purpose,
          occasion || order.occasion,
          order.voice_gender ? `${order.voice_gender} vocals` : null,
          modifications || null,
        ].filter(Boolean)

        const combinedStyle = styleComponents.join(", ").trim() || "pop"

        // Build title
        const title = personName
          ? `Canción para ${personName}`
          : order.person_name
            ? `Canción para ${order.person_name}`
            : "Mi Canción"

        // Build callback URL
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
        const callBackUrl = `${baseUrl}/api/webhook/suno?orderId=${orderId}&type=create-new`

        console.log("[Create-New] Generating new song:", {
          orderId,
          title,
          style: combinedStyle,
          lyricsLength: lyricText.length,
          callBackUrl,
        })

        // Call Suno API to generate new song
        result = await generateCustomMusic({
          lyric: lyricText,
          style: combinedStyle,
          title,
          model: model || "V4_5",
          callBackUrl,
        })

        // Extract taskId from result (API may return taskId or task_id)
        const data = result.data as { taskId?: string; task_id?: string } | undefined
        const taskId = data?.taskId ?? data?.task_id

        if (taskId) {
          // Update order to track the new generation
          await db
            .from("orders")
            .update({
              suno_task_id: taskId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId)
        }

        console.log("[Create-New] Song generation initiated:", { orderId, taskId })
        break
      }

      // ============================================
      // REPLACE-SECTION: Modify a specific section
      // ============================================
      case "replace-section": {
        const { audioId, prompt, sectionStart, sectionEnd, orderId: orderIdFromBody, taskId: taskIdFromBody, tags: tagsFromBody, title: titleFromBody, negativeTags, fullLyrics } = body

        if (!audioId) {
          return jsonCors(origin, { success: false, message: "audioId is required for replace-section operation" }, { status: 400 })
        }

        if (!prompt || sectionStart === undefined || sectionEnd === undefined) {
          return jsonCors(origin, { success: false, message: "Prompt, section start and end times are required for replace operation" }, { status: 400 })
        }

        if (typeof sectionStart !== "number" || typeof sectionEnd !== "number") {
          return jsonCors(origin, { success: false, message: "sectionStart and sectionEnd must be numbers" }, { status: 400 })
        }

        // Ensure 2 decimal precision (API usa infillStartS e infillEndS)
        const infillStartS = parseFloat(sectionStart.toFixed(2))
        const infillEndS = parseFloat(sectionEnd.toFixed(2))

        // Validate section parameters
        const validation = validateReplaceSection(infillStartS, infillEndS)
        if (!validation.valid) {
          return jsonCors(origin, { success: false, message: validation.error }, { status: 400 })
        }

        // Resolve orderId: del body o buscando por suno_audio_id (audioId) para obtener taskId, tags, title y callback
        let orderId = orderIdFromBody
        let order: any = null
        if (!orderId) {
          const { data: orderByAudio } = await db
            .from("orders")
            .select("*")
            .eq("suno_audio_id", audioId)
            .maybeSingle()
          if (orderByAudio) {
            orderId = orderByAudio.id
            order = orderByAudio
          }
        } else {
          const { data: orderData, error: orderErr } = await db
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .single()
          if (!orderErr && orderData) order = orderData
        }

        // Require a resolved order for replace-section (same as /api/orders/replace-section)
        if (!order) {
          return jsonCors(origin, {
            success: false,
            message: "Order not found. orderId or an audioId belonging to an order is required for replace-section.",
          }, { status: 404 })
        }

        // Enforce payment and edit limit (same as /api/orders/replace-section)
        if (order.payment_status !== "paid") {
          return jsonCors(origin, { success: false, message: "Payment required" }, { status: 403 })
        }

        const editsUsed = (order as { edits_used?: number }).edits_used ?? 0
        if (editsUsed >= 1) {
          return jsonCors(origin, {
            success: false,
            message: "Ya has utilizado tu edición gratuita incluida.",
            code: "EDIT_LIMIT_REACHED",
            editsUsed,
          }, { status: 403 })
        }

        // Ensure audioId matches the order (prevent using one order's permission with another order's audio)
        if (order.suno_audio_id && order.suno_audio_id !== audioId) {
          return jsonCors(origin, {
            success: false,
            message: "audioId does not match the order",
          }, { status: 403 })
        }

        // taskId, tags y title son requeridos por la API: del body o de la orden
        const taskId = taskIdFromBody || order?.suno_task_id
        const tags = tagsFromBody || order?.genre || order?.styles || "pop"
        const title = titleFromBody || (order?.person_name ? `Canción para ${order.person_name}` : "Mi Canción")

        if (!taskId) {
          return jsonCors(origin, { success: false, message: "taskId is required for replace-section (envíalo en el body o asegura que la orden tenga suno_task_id)" }, { status: 400 })
        }

        if (!tags || !title) {
          return jsonCors(origin, { success: false, message: "tags and title are required for replace-section (envíalos en el body o asegura que la orden tenga genre/styles y person_name)" }, { status: 400 })
        }

        // Build callback URL para que el webhook actualice la orden cuando Suno termine
        let callBackUrl: string | undefined
        if (orderId) {
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
          callBackUrl = `${baseUrl}/api/webhook/suno?orderId=${orderId}&type=replace-section`
        }

        console.log("[Replace-Section] Modifying song section:", {
          taskId,
          audioId,
          infillStartS,
          infillEndS,
          prompt: prompt.substring(0, 100) + "...",
          tags,
          title,
          callBackUrl,
        })

        result = await replaceSongSection(
          taskId,
          audioId,
          prompt,
          tags,
          title,
          infillStartS,
          infillEndS,
          negativeTags,
          fullLyrics,
          callBackUrl
        )
        break
      }

      // ============================================
      // EXTEND: Continue a song from a specific point
      // ============================================
      case "extend": {
        const { audioId, continueAt, lyric, style } = body

        if (!audioId) {
          return jsonCors(origin, { success: false, message: "audioId is required for extend operation" }, { status: 400 })
        }

        if (!continueAt || !lyric) {
          return jsonCors(origin, { success: false, message: "Continue at time and lyrics are required for extend operation" }, { status: 400 })
        }
        result = await extendSong(audioId, continueAt, lyric, style)
        break
      }

      // ============================================
      // CONCATENATE: Get concatenated song
      // ============================================
      case "concatenate": {
        const { audioId } = body

        if (!audioId) {
          return jsonCors(origin, { success: false, message: "audioId is required for concatenate operation" }, { status: 400 })
        }

        result = await getConcatenatedSong(audioId)
        break
      }

      // ============================================
      // COVER: Create a cover version
      // ============================================
      case "cover": {
        const { audioId, coverLyric, coverStyle, model } = body

        if (!audioId) {
          return jsonCors(origin, { success: false, message: "audioId is required for cover operation" }, { status: 400 })
        }

        if (!coverLyric || !coverStyle) {
          return jsonCors(origin, { success: false, message: "Lyrics and style are required for cover operation" }, { status: 400 })
        }
        result = await coverSong(audioId, coverLyric, coverStyle, model)
        break
      }

      // ============================================
      // SEPARATE: Separate vocals and instrumental
      // ============================================
      case "separate": {
        const { audioId } = body

        if (!audioId) {
          return jsonCors(origin, { success: false, message: "audioId is required for separate operation" }, { status: 400 })
        }

        result = await separateVocalsAndInstrumental(audioId)
        break
      }

      default:
        return jsonCors(origin, { success: false, message: `Unknown operation type: ${operation}` }, { status: 400 })
    }

    // Check if result indicates success
    const resultData = result.data as { taskId?: string; task_id?: string } | undefined
    const resultTaskId = resultData?.taskId ?? resultData?.task_id
    if (result.code === 200) {
      return jsonCors(origin, {
        success: true,
        taskId: resultTaskId,
        message: "Operation initiated successfully",
        data: result.data,
      })
    } else {
      return jsonCors(origin, {
        success: false,
        message: result.msg || "Operation failed",
        code: result.code,
        data: result.data,
      })
    }
  } catch (error) {
    console.error("Error performing Suno song operation:", error)
    return jsonCors(origin, {
      success: false,
      message: "Error performing song operation",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 })
  }
}
