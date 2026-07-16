import { NextResponse } from "next/server"
import { supabase, supabaseAdmin } from "@/lib/supabase"
import { SunoTaskResponse, TaskStatus } from "@/lib/suno-api"

// Cliente con privilegios admin para operaciones sin contexto de usuario (callbacks de Suno)
const db = supabaseAdmin ?? supabase

/**
 * WEBHOOK SUNO – CÓDIGO YA PROBADO Y FUNCIONANDO
 * -----------------------------------------------
 * Este endpoint recibe callbacks de Suno. Los siguientes flujos están en uso y funcionan:
 *
 * 1. VIDEO:     ?type=video     → handleVideoCallback (body.data.video_url, body.data.task_id)
 * 2. CANCIÓN:   sin type        → flujo principal (callbackType "complete", sunoData, audio_url)
 * 3. CREATE-NEW: ?type=create-new   → handleCreateNewCallback (regeneración completa)
 * 4. REPLACE-SECTION: ?type=replace-section → handleReplaceSectionCallback (modificar sección)
 *
 * No cambiar la lógica de enrutado (hasVideoUrl, hasSunoData, callbackTypeParam) sin verificar
 * que video y canción siguen funcionando.
 */

/**
 * Maneja callbacks de create-new (regeneración completa de canción)
 *
 * Cuando una canción completamente nueva ha sido generada exitosamente,
 * Suno envía un callback con el nuevo audio_url
 */
async function handleCreateNewCallback(
  body: any,
  orderId: string | null,
  taskId: string | null,
  isError: boolean,
  errorMessage: string | undefined,
  actualStatus: string | undefined,
  request: Request
): Promise<NextResponse> {
  console.log('[Suno Webhook] Procesando callback de create-new:', {
    orderId,
    taskId,
    isError,
    errorMessage,
    status: actualStatus,
  })

  // Si hay error en el callback
  if (isError) {
    console.error('[Suno Webhook] Error en create-new:', {
      errorMessage,
      orderId,
      taskId,
    })

    if (orderId) {
      await db
        .from("orders")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
    }

    return NextResponse.json({
      success: true,
      message: "Error en create-new procesado",
      error: errorMessage || "Error desconocido",
    })
  }

  // Extraer datos del callback - la estructura es similar a la generación normal
  const sunoData = body.response?.sunoData || body.data?.response?.sunoData || body.data?.data
  const callbackType = body.data?.callbackType || body.callbackType

  // Solo procesar cuando el callback sea "complete"
  if (callbackType !== "complete") {
    console.log('[Suno Webhook] Create-new callback recibido pero no es "complete":', {
      callbackType,
      orderId,
    })
    return NextResponse.json({
      success: true,
      message: `Create-new callback recibido (${callbackType}), esperando "complete"`,
    })
  }

  if (!orderId) {
    console.error('[Suno Webhook] Create-new callback sin orderId')
    return NextResponse.json({ success: true, message: "orderId es requerido" })
  }

  // Buscar la orden
  const { data: order, error: orderError } = await db
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single()

  if (orderError || !order) {
    console.error('[Suno Webhook] No se encontró orden con orderId:', orderId)
    return NextResponse.json({ success: true, message: "Orden no encontrada" })
  }

  if (!sunoData || sunoData.length === 0) {
    console.error('[Suno Webhook] Create-new callback sin datos de audio')
    return NextResponse.json({ success: true, message: "Sin datos de audio" })
  }

  // Obtener el nuevo audio del resultado
  const track = sunoData[0]
  let newAudioUrl = track.audio_url || track.audioUrl || track.source_audio_url || track.stream_audio_url

  if (!newAudioUrl) {
    console.error('[Suno Webhook] Create-new callback sin audio_url')
    return NextResponse.json({ success: true, message: "Sin audio_url en el resultado" })
  }

  // Validar que la URL sea válida
  try {
    new URL(newAudioUrl)
  } catch (error) {
    console.error('[Suno Webhook] audio_url no es una URL válida:', newAudioUrl)
    return NextResponse.json({
      success: false,
      error: "URL de audio inválida",
      audioUrl: newAudioUrl,
    }, { status: 400 })
  }

  // Obtener image_url si existe
  let newImageUrl = track.image_url || track.imageUrl || null
  if (newImageUrl) {
    try {
      new URL(newImageUrl)
    } catch (error) {
      newImageUrl = null
    }
  }

  console.log('[Suno Webhook] Create-new completado exitosamente:', {
    orderId: order.id,
    newAudioUrl,
    previousAudioUrl: order.audio_url,
    newImageUrl,
  })

  // Para create-new, la nueva canción siempre va a audio_url_alt y la original/anterior a audio_url.
  // Esto garantiza que el mensaje de WhatsApp siempre etiquete correctamente:
  //   audio_url_alt = "Nueva versión", audio_url = "Original"
  const updateData: any = {
    updated_at: new Date().toISOString(),
    // Incrementar contador de ediciones usadas
    edits_used: ((order as { edits_used?: number }).edits_used ?? 0) + 1,
  }

  if (order.audio_url_alt) {
    // Ya hay una versión alternativa previa: mover la anterior alt a audio_url,
    // y poner la nueva canción en audio_url_alt (siempre la más reciente)
    updateData.audio_url = order.audio_url_alt
    updateData.audio_url_alt = newAudioUrl
    if (order.image_url_alt) {
      updateData.image_url = order.image_url_alt
    }
    if (newImageUrl) {
      updateData.image_url_alt = newImageUrl
    }
  } else {
    // No hay versión alternativa, guardar nueva como alternativa manteniendo la original
    updateData.audio_url_alt = newAudioUrl
    if (newImageUrl) {
      updateData.image_url_alt = newImageUrl
    }
  }

  // Guardar el nuevo suno_audio_id si está disponible
  if (track.id) {
    updateData.suno_audio_id = track.id
  }

  // Guardar el nuevo taskId si está disponible
  if (taskId) {
    updateData.suno_task_id = taskId
  }

  const { error: updateError } = await db
    .from("orders")
    .update(updateData)
    .eq("id", order.id)

  if (updateError) {
    console.error('[Suno Webhook] Error al actualizar orden con nuevo audio:', updateError)
    return NextResponse.json(
      { success: false, error: "Error al actualizar orden", details: updateError.message },
      { status: 500 }
    )
  }

  console.log('[Suno Webhook] Orden actualizada con nueva canción:', {
    orderId: order.id,
    newAudioUrl,
    savedAs: 'audio_url_alt',
    previousAltMovedTo: order.audio_url_alt ? 'audio_url' : null,
  })

  // Enviar notificación por WhatsApp si hay número registrado
  if (order.whatsapp) {
    try {
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

      console.log('[Suno Webhook] Enviando nueva canción por WhatsApp...')
      const sendSongResponse = await fetch(`${baseUrl}/api/whatsapp/send-song`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, context: "create-new" }),
      })

      if (sendSongResponse.ok) {
        console.log('[Suno Webhook] Nueva canción enviada por WhatsApp')
      } else {
        console.error('[Suno Webhook] Error al enviar nueva canción por WhatsApp')
      }
    } catch (error) {
      console.error('[Suno Webhook] Excepción al enviar canción por WhatsApp:', error)
    }
  }

  return NextResponse.json({
    success: true,
    message: "Create-new completado exitosamente",
    orderId: order.id,
    newAudioUrl,
  })
}

/**
 * Maneja callbacks de replace-section
 * Documentación: https://docs.kie.ai/suno-api/replace-section-callbacks
 *
 * Cuando una sección de la canción ha sido reemplazada exitosamente,
 * Suno envía un callback con el nuevo audio_url
 */
async function handleReplaceSectionCallback(
  body: any,
  orderId: string | null,
  taskId: string | null,
  isError: boolean,
  errorMessage: string | undefined,
  actualStatus: string | undefined,
  request: Request
): Promise<NextResponse> {
  console.log('[Suno Webhook] Procesando callback de replace-section:', {
    orderId,
    taskId,
    isError,
    errorMessage,
    status: actualStatus,
  })

  // Si hay error en el callback
  if (isError) {
    console.error('[Suno Webhook] Error en replace-section:', {
      errorMessage,
      orderId,
      taskId,
    })

    if (orderId) {
      await db
        .from("orders")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
    }

    return NextResponse.json({
      success: true,
      message: "Error en replace-section procesado",
      error: errorMessage || "Error desconocido",
    })
  }

  // Extraer datos del callback - la estructura es similar a la generación normal
  const sunoData = body.response?.sunoData || body.data?.response?.sunoData || body.data?.data
  const callbackType = body.data?.callbackType || body.callbackType

  // Solo procesar cuando el callback sea "complete"
  if (callbackType !== "complete") {
    console.log('[Suno Webhook] Replace-section callback recibido pero no es "complete":', {
      callbackType,
      orderId,
    })
    return NextResponse.json({
      success: true,
      message: `Replace-section callback recibido (${callbackType}), esperando "complete"`,
    })
  }

  if (!orderId) {
    console.error('[Suno Webhook] Replace-section callback sin orderId')
    return NextResponse.json({ success: true, message: "orderId es requerido" })
  }

  // Buscar la orden
  const { data: order, error: orderError } = await db
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single()

  if (orderError || !order) {
    console.error('[Suno Webhook] No se encontró orden con orderId:', orderId)
    return NextResponse.json({ success: true, message: "Orden no encontrada" })
  }

  if (!sunoData || sunoData.length === 0) {
    console.error('[Suno Webhook] Replace-section callback sin datos de audio')
    return NextResponse.json({ success: true, message: "Sin datos de audio" })
  }

  // Obtener el nuevo audio del resultado
  const track = sunoData[0]
  let newAudioUrl = track.audio_url || track.audioUrl || track.source_audio_url || track.stream_audio_url

  if (!newAudioUrl) {
    console.error('[Suno Webhook] Replace-section callback sin audio_url')
    return NextResponse.json({ success: true, message: "Sin audio_url en el resultado" })
  }

  // Validar que la URL sea válida
  try {
    new URL(newAudioUrl)
  } catch (error) {
    console.error('[Suno Webhook] audio_url no es una URL válida:', newAudioUrl)
    return NextResponse.json({
      success: false,
      error: "URL de audio inválida",
      audioUrl: newAudioUrl,
    }, { status: 400 })
  }

  // Obtener image_url si existe
  let newImageUrl = track.image_url || track.imageUrl || null
  if (newImageUrl) {
    try {
      new URL(newImageUrl)
    } catch (error) {
      newImageUrl = null
    }
  }

  console.log('[Suno Webhook] Replace-section completado exitosamente:', {
    orderId: order.id,
    newAudioUrl,
    previousAudioUrl: order.audio_url,
    newImageUrl,
  })

  // Actualizar la orden con la nueva URL de audio
  // Guardamos el audio original en audio_url_original si no existe
  // y el nuevo audio modificado en audio_url
  const updateData: any = {
    audio_url: newAudioUrl,
    updated_at: new Date().toISOString(),
    // Incrementar contador de ediciones usadas
    edits_used: ((order as { edits_used?: number }).edits_used ?? 0) + 1,
  }

  // Si hay una URL de imagen nueva, actualizarla
  if (newImageUrl) {
    updateData.image_url = newImageUrl
  }

  // Guardar el nuevo suno_audio_id si está disponible
  if (track.id) {
    updateData.suno_audio_id = track.id
  }

  // Guardar el nuevo taskId si está disponible
  if (taskId) {
    updateData.suno_task_id = taskId
  }

  const { error: updateError } = await db
    .from("orders")
    .update(updateData)
    .eq("id", order.id)

  if (updateError) {
    console.error('[Suno Webhook] Error al actualizar orden con nuevo audio:', updateError)
    return NextResponse.json(
      { success: false, error: "Error al actualizar orden", details: updateError.message },
      { status: 500 }
    )
  }

  console.log('[Suno Webhook] Orden actualizada con audio modificado:', {
    orderId: order.id,
    newAudioUrl,
  })

  // Enviar notificación por WhatsApp si hay número registrado
  if (order.whatsapp) {
    try {
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

      console.log('[Suno Webhook] Enviando canción modificada por WhatsApp...')
      const sendSongResponse = await fetch(`${baseUrl}/api/whatsapp/send-song`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, context: "replace-section" }),
      })

      if (sendSongResponse.ok) {
        console.log('[Suno Webhook] Canción modificada enviada por WhatsApp')
      } else {
        console.error('[Suno Webhook] Error al enviar canción modificada por WhatsApp')
      }
    } catch (error) {
      console.error('[Suno Webhook] Excepción al enviar canción por WhatsApp:', error)
    }
  }

  return NextResponse.json({
    success: true,
    message: "Replace-section completado exitosamente",
    orderId: order.id,
    newAudioUrl,
  })
}

/**
 * Maneja callbacks de generación de video
 * Documentación: https://docs.kie.ai/suno-api/create-music-video-callbacks
 *
 * Formato del callback:
 * {
 *   "code": 200,
 *   "msg": "success",
 *   "data": {
 *     "task_id": "task_id_5bbe7721119d",
 *     "video_url": "video_url_847715e66259"
 *   }
 * }
 */
async function handleVideoCallback(
  body: any,
  orderId: string | null,
  taskId: string | null,
  isError: boolean,
  errorMessage: string | undefined,
  actualStatus: TaskStatus | undefined
): Promise<NextResponse> {
  console.log('[Suno Webhook] Procesando callback de video:', {
    orderId,
    taskId,
    isError,
    errorMessage,
    status: actualStatus,
    bodyCode: body.code,
    bodyMsg: body.msg,
  })

  // Según la documentación, el código 200 es éxito, 500 es error
  const code = body.code
  const msg = body.msg || ""
  const callbackData = body.data || {}
  const videoTaskId = callbackData.task_id || taskId

  // Si hay error (código 500 o cualquier código que no sea 200)
  if (code !== 200 || isError) {
    console.error('[Suno Webhook] Error en generación de video:', {
      code,
      msg,
      orderId,
      videoTaskId,
    })

    if (orderId) {
      await db
        .from("orders")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
    }

    return NextResponse.json({
      success: true,
      message: "Error en generación de video procesado",
      error: msg || errorMessage || `Código: ${code}`,
    })
  }

  // Extraer video_url del callback según el formato oficial
  // El video_url está en body.data.video_url según la documentación
  const videoUrl = callbackData.video_url

  if (!videoUrl) {
    console.warn('[Suno Webhook] Callback de video recibido pero no hay video_url en data.video_url')
    console.log('[Suno Webhook] Estructura completa del callback:', JSON.stringify(body, null, 2))
    return NextResponse.json({
      success: true,
      message: "Callback de video recibido pero video_url aún no disponible",
    })
  }

  // Validar que la URL sea válida
  try {
    new URL(videoUrl)
  } catch (error) {
    console.error('[Suno Webhook] videoUrl no es una URL válida:', videoUrl)
    if (orderId) {
      await db
        .from("orders")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
    }
    return NextResponse.json({
      success: false,
      error: "URL de video inválida",
      videoUrl,
    }, { status: 400 })
  }

  // Si no hay orderId, no podemos actualizar la orden
  if (!orderId) {
    console.warn('[Suno Webhook] Callback de video recibido pero no hay orderId')
    return NextResponse.json({
      success: true,
      message: "Callback de video recibido pero no se puede asociar con una orden",
      videoUrl,
    })
  }

  // Buscar la orden
  const { data: order, error: orderError } = await db
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single()

  if (orderError || !order) {
    console.error('[Suno Webhook] No se encontró orden con orderId:', orderId)
    return NextResponse.json({ 
      success: true, 
      message: "Orden no encontrada",
      videoUrl,
    })
  }

  // Actualizar la orden con el video_url
  const { error: updateError } = await db
    .from("orders")
    .update({
      video_url: videoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)

  if (updateError) {
    console.error('[Suno Webhook] Error al actualizar orden con video_url:', updateError)
    return NextResponse.json(
      { 
        success: false, 
        error: "Error al actualizar orden", 
        details: updateError.message 
      },
      { status: 500 }
    )
  }

  console.log('[Suno Webhook] Video generado exitosamente:', {
    orderId: order.id,
    videoTaskId,
    videoUrl,
    note: "Video URL válida por 14 días según documentación",
  })

  // Nota importante: Según la documentación, el video_url es válido por 14 días
  // Se recomienda descargar y guardar el video localmente
  // Por ahora solo guardamos la URL, pero se podría implementar descarga automática

  return NextResponse.json({
    success: true,
    message: "Video generado exitosamente",
    orderId: order.id,
    videoTaskId,
    videoUrl,
    note: "Video URL válida por 14 días",
  })
}

/**
 * Webhook para recibir callbacks de Suno API
 * Este endpoint es llamado por Suno cuando la generación de una canción está completa
 * 
 * Configuración en Suno: Debes proporcionar esta URL como callBackUrl al generar la canción
 * Formato: https://tu-dominio.com/api/webhook/suno
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Extraer orderId y tipo de callback de los query parameters
    // En Next.js 13+, request.url contiene la URL completa
    let orderId: string | null = null
    let callbackTypeParam: string | null = null
    
    // Intentar obtener orderId y type de la URL
    if (request.url) {
      try {
        const url = new URL(request.url)
        orderId = url.searchParams.get("orderId")
        callbackTypeParam = url.searchParams.get("type") // "video" o null para audio
      } catch (error) {
        console.warn('[Suno Webhook] No se pudo parsear URL:', error)
      }
    }
    
    // También verificar si Suno envía el orderId en el body (si lo agregamos como metadata)
    if (!orderId && body.orderId) {
      orderId = body.orderId
    }

    // Determinar si es un callback de video o replace-section
    // Según la documentación: https://docs.kie.ai/suno-api/create-music-video-callbacks
    //
    // Callbacks de VIDEO tienen:
    // - body.code y body.msg (formato estándar)
    // - body.data.video_url (específico de video)
    // - body.data.task_id
    // - NO tienen body.response?.sunoData (eso es de audio)
    //
    // Callbacks de AUDIO tienen:
    // - body.response?.sunoData o body.data?.response?.sunoData (tracks)
    // - body.data?.callbackType ("text", "complete", "first")
    // - NO tienen body.data.video_url
    //
    // Callbacks de REPLACE-SECTION tienen:
    // - type=replace-section en URL query param
    // - Estructura similar a callbacks de audio
    //
    // Callbacks de CREATE-NEW tienen:
    // - type=create-new en URL query param
    // - Estructura igual a callbacks de audio (es una regeneración completa)
    //
    // Prioridad: 1) Parámetro type en URL (más confiable), 2) Presencia de video_url sin sunoData
    const hasVideoUrl = body.data && body.data.video_url !== undefined
    const hasSunoData = !!(body.response?.sunoData || body.data?.response?.sunoData)
    const hasAudioCallbackType = !!(body.data?.callbackType || body.callbackType)

    const isReplaceSectionCallback = callbackTypeParam === "replace-section"
    const isCreateNewCallback = callbackTypeParam === "create-new"
    const isVideoCallback = callbackTypeParam === "video" ||
                           (hasVideoUrl && !hasSunoData && !hasAudioCallbackType)

    console.log('[Suno Webhook] Callback recibido:', JSON.stringify(body, null, 2))
    console.log('[Suno Webhook] OrderId desde URL:', orderId)
    console.log('[Suno Webhook] Es callback de replace-section:', isReplaceSectionCallback)
    console.log('[Suno Webhook] Es callback de create-new:', isCreateNewCallback)
    console.log('[Suno Webhook] Es callback de video:', isVideoCallback)

    // Extraer datos del callback de Suno
    // El taskId puede estar en diferentes ubicaciones según el tipo de callback
    const taskId = body.taskId || body.data?.taskId || body.data?.task_id
    const callbackType = body.data?.callbackType || body.callbackType // "text", "complete", etc.
    const status: TaskStatus = body.status || body.data?.status
    const errorMessage = body.errorMessage || body.data?.errorMessage
    const sunoData = body.response?.sunoData || body.data?.response?.sunoData || body.data?.data

    // Determinar el estado basado en el callbackType si no hay status explícito
    let actualStatus: TaskStatus = status
    if (!actualStatus && callbackType) {
      if (callbackType === "text") {
        actualStatus = "TEXT_SUCCESS"
      } else if (callbackType === "complete") {
        actualStatus = "SUCCESS"
      } else if (callbackType === "first") {
        actualStatus = "FIRST_SUCCESS"
      }
    }

    console.log('[Suno Webhook] Procesando callback:', {
      taskId,
      callbackType,
      status: actualStatus,
      hasError: !!errorMessage,
      hasSunoData: !!sunoData,
      tracksCount: sunoData?.length || 0,
    })

    // Verificar si hay errores en el callback
    const isError = actualStatus === "CREATE_TASK_FAILED" ||
                    actualStatus === "GENERATE_AUDIO_FAILED" ||
                    actualStatus === "CALLBACK_EXCEPTION" ||
                    actualStatus === "SENSITIVE_WORD_ERROR"

    // Si es un callback de replace-section, procesarlo de manera específica
    if (isReplaceSectionCallback) {
      return await handleReplaceSectionCallback(body, orderId, taskId, isError, errorMessage, actualStatus, request)
    }

    // Si es un callback de create-new, procesarlo de manera específica
    if (isCreateNewCallback) {
      return await handleCreateNewCallback(body, orderId, taskId, isError, errorMessage, actualStatus, request)
    }

    // Si es un callback de video, procesarlo de manera diferente
    if (isVideoCallback) {
      return await handleVideoCallback(body, orderId, taskId, isError, errorMessage, actualStatus)
    }

    // Solo procesar cuando el callback sea "complete" o cuando haya un error
    // Para otros tipos de callbacks (text, first, etc.), solo retornar 200 OK sin hacer nada
    if (callbackType !== "complete" && !isError) {
      console.log('[Suno Webhook] Callback recibido pero no es "complete" ni error, solo retornando 200 OK:', {
        callbackType,
        actualStatus,
        orderId,
      })
      return NextResponse.json({
        success: true,
        message: `Callback recibido (${callbackType}), esperando callback "complete"`,
      })
    }

    // Si el callback es "complete" o hay un error, necesitamos el orderId para procesar
    if (!orderId && !taskId) {
      console.error('[Suno Webhook] Callback "complete" o error pero no se recibió orderId ni taskId')
      return NextResponse.json(
        { success: false, error: "orderId o taskId es requerido para procesar callback" },
        { status: 400 }
      )
    }

    // Buscar la orden por orderId si está disponible, sino por estado "generating"
    let order

    if (orderId) {
      const { data: orderData, error: orderError } = await db
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single()

      if (orderError || !orderData) {
        console.error('[Suno Webhook] No se encontró orden con orderId:', orderId)
        // Responder 200 para que Suno no reintente
        return NextResponse.json({ success: true, message: "Orden no encontrada" })
      }

      order = orderData
    } else {
      // Fallback: buscar por estado "generating" (menos preciso)
      console.warn('[Suno Webhook] No se proporcionó orderId, buscando por estado "generating"')
      const { data: orders, error: searchError } = await db
        .from("orders")
        .select("*")
        .eq("status", "generating")
        .order("updated_at", { ascending: false })
        .limit(1)

      if (searchError || !orders || orders.length === 0) {
        console.error('[Suno Webhook] No se encontró orden en estado "generating"')
        // Responder 200 para que Suno no reintente
        return NextResponse.json({ success: true, message: "Orden no encontrada" })
      }

      order = orders[0]
    }

    // Manejar errores primero
    if (isError) {
      console.error('[Suno Webhook] Error en generación:', {
        status: actualStatus,
        errorMessage,
        orderId: order.id,
      })

      // Actualizar orden con estado de error
      await db
        .from("orders")
        .update({
          status: "error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)

      return NextResponse.json({
        success: true,
        message: "Error procesado",
        error: errorMessage || actualStatus,
      })
    }

    // Procesar el callback "complete"
    // Ya verificamos arriba que callbackType === "complete" y que no hay errores
    if (!sunoData || sunoData.length === 0) {
      console.error('[Suno Webhook] Callback "complete" pero no hay datos de canciones')
      await db
        .from("orders")
        .update({
          status: "error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)

      return NextResponse.json({ success: true, message: "Procesado sin datos" })
    }

    // Obtener la primera canción generada (Suno genera 2 versiones, usamos la primera)
    const track = sunoData[0]
    console.log('[Suno Webhook] Procesando track:', {
      id: track.id,
      title: track.title,
      hasAudioUrl: !!track.audio_url,
      hasAudioUrlCamel: !!track.audioUrl,
      hasSourceAudioUrl: !!track.source_audio_url,
      hasStreamAudioUrl: !!track.stream_audio_url,
      hasImageUrl: !!track.image_url,
      hasImageUrlCamel: !!track.imageUrl,
    })
    
    // Intentar obtener audio_url de diferentes campos posibles
    // Prioridad: audio_url > audioUrl > source_audio_url > source_stream_audio_url > stream_audio_url
    let audioUrl = track.audio_url || track.audioUrl || track.source_audio_url || track.source_stream_audio_url || track.stream_audio_url

    // Si no hay audio_url pero hay stream_audio_url, usar ese como fallback
    if (!audioUrl || audioUrl === "") {
      if (track.stream_audio_url || track.source_stream_audio_url) {
        audioUrl = track.stream_audio_url || track.source_stream_audio_url
        console.log('[Suno Webhook] Usando stream_audio_url como fallback:', audioUrl)
      }
    }

    // Obtener image_url de la primera canción
    let imageUrl = track.image_url || track.imageUrl || null
    if (imageUrl) {
      try {
        new URL(imageUrl)
        console.log('[Suno Webhook] Image URL de primera versión:', imageUrl)
      } catch (error) {
        console.warn('[Suno Webhook] image_url no es una URL válida, ignorando:', imageUrl)
        imageUrl = null
      }
    }

    if (!audioUrl || audioUrl === "") {
      console.error('[Suno Webhook] No se encontró audioUrl en los datos, pero el callback indica SUCCESS')
      console.log('[Suno Webhook] Datos completos del track:', JSON.stringify(track, null, 2))
      
      // Si el callback es "complete" pero no hay audio_url, puede que aún no esté disponible
      // Actualizar el estado pero no marcar como error
      await db
        .from("orders")
        .update({
          status: "generating",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)

      return NextResponse.json({
        success: true,
        message: "Callback recibido pero audio_url aún no disponible",
        callbackType,
      })
    }

    // Validar que la URL sea válida
    try {
      new URL(audioUrl)
    } catch (error) {
      console.error('[Suno Webhook] audioUrl no es una URL válida:', audioUrl)
      await db
        .from("orders")
        .update({
          status: "error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)

      return NextResponse.json({
        success: false,
        error: "URL de audio inválida",
        audioUrl,
      }, { status: 400 })
    }

    // Procesar segunda versión si el plan lo requiere
    let audioUrlAlt: string | null = null
    let imageUrlAlt: string | null = null
    const songTypeLower = order.song_type?.toLowerCase() || ""
    const isMultipleVersionsPlan = songTypeLower.includes("estandar") || 
                                   songTypeLower.includes("standard") || 
                                   songTypeLower.includes("premium")

    if (isMultipleVersionsPlan && sunoData.length > 1) {
      const track2 = sunoData[1]
      console.log('[Suno Webhook] Procesando segunda versión para plan múltiple:', {
        id: track2.id,
        title: track2.title,
        hasAudioUrl: !!track2.audio_url,
        hasImageUrl: !!track2.image_url,
      })

      // Intentar obtener audio_url de la segunda versión con la misma prioridad
      audioUrlAlt = track2.audio_url || track2.audioUrl || track2.source_audio_url || track2.source_stream_audio_url || track2.stream_audio_url

      // Si no hay audio_url pero hay stream_audio_url, usar ese como fallback
      if (!audioUrlAlt || audioUrlAlt === "") {
        if (track2.stream_audio_url || track2.source_stream_audio_url) {
          audioUrlAlt = track2.stream_audio_url || track2.source_stream_audio_url
          console.log('[Suno Webhook] Usando stream_audio_url como fallback para segunda versión:', audioUrlAlt)
        }
      }

      // Validar que la segunda URL sea válida si existe
      if (audioUrlAlt && audioUrlAlt !== "") {
        try {
          new URL(audioUrlAlt)
          console.log('[Suno Webhook] Segunda versión validada exitosamente:', audioUrlAlt)
        } catch (error) {
          console.error('[Suno Webhook] audioUrlAlt no es una URL válida:', audioUrlAlt)
          audioUrlAlt = null // Invalidar si no es válida
        }
      } else {
        console.warn('[Suno Webhook] Plan requiere múltiples versiones pero segunda versión no tiene audio_url')
      }

      // Obtener image_url de la segunda versión
      imageUrlAlt = track2.image_url || track2.imageUrl || null
      if (imageUrlAlt) {
        try {
          new URL(imageUrlAlt)
          console.log('[Suno Webhook] Image URL de segunda versión:', imageUrlAlt)
        } catch (error) {
          console.warn('[Suno Webhook] image_url_alt no es una URL válida, ignorando:', imageUrlAlt)
          imageUrlAlt = null
        }
      }
    }

    console.log('[Suno Webhook] Canción generada exitosamente:', {
      orderId: order.id,
      audioUrl,
      title: track.title,
      duration: track.duration,
      paymentStatus: order.payment_status,
      hasWhatsApp: !!order.whatsapp,
    })

    // Determinar el nuevo estado de la orden
    // La canción está lista, pero el estado final depende del pago
    // Si el pago está confirmado, marcar como completado, sino como pendiente de pago
    const newStatus = order.payment_status === "paid" ? "completed" : "pending_payment"
    const completedAt = order.payment_status === "paid" ? new Date().toISOString() : null

    console.log('[Suno Webhook] Actualizando orden:', {
      orderId: order.id,
      audioUrl,
      audioUrlAlt,
      imageUrl,
      imageUrlAlt,
      hasMultipleVersions: !!audioUrlAlt,
      newStatus,
      completedAt,
    })

    // Actualizar la orden con la URL del audio e imagen (y segundas versiones si existen)
    // También guardar taskId y audioId para poder generar videos automáticamente
    const updateData: any = {
      audio_url: audioUrl,
      status: newStatus,
      updated_at: new Date().toISOString(),
      completed_at: completedAt,
    }

    // Guardar taskId y audioId si están disponibles (para generar videos automáticamente)
    if (taskId) {
      updateData.suno_task_id = taskId
    }
    if (track.id) {
      updateData.suno_audio_id = track.id
    }

    // Solo agregar audio_url_alt si existe una segunda versión válida
    if (audioUrlAlt) {
      updateData.audio_url_alt = audioUrlAlt
    }

    // Agregar image_url si existe
    if (imageUrl) {
      updateData.image_url = imageUrl
    }

    // Agregar image_url_alt si existe
    if (imageUrlAlt) {
      updateData.image_url_alt = imageUrlAlt
    }

    const { data: updatedOrder, error: updateError } = await db
      .from("orders")
      .update(updateData)
      .eq("id", order.id)
      .select()
      .single()

    if (updateError) {
      console.error('[Suno Webhook] Error al actualizar orden:', updateError)
      return NextResponse.json(
        { success: false, error: "Error al actualizar orden", details: updateError.message },
        { status: 500 }
      )
    }

    console.log('[Suno Webhook] Orden actualizada exitosamente:', {
      orderId: updatedOrder.id,
      status: updatedOrder.status,
      audioUrl: updatedOrder.audio_url,
    })

    // Enviar automáticamente la canción por WhatsApp si hay número de WhatsApp
    // El endpoint send-song ya maneja la lógica de preview vs completa según el estado de pago
    if (order.whatsapp) {
      try {
        // Construir URL base para la llamada interna
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
        
        console.log('[Suno Webhook] Enviando canción por WhatsApp automáticamente...')
        const sendSongResponse = await fetch(`${baseUrl}/api/whatsapp/send-song`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id }),
        })

        if (sendSongResponse.ok) {
          const sendSongData = await sendSongResponse.json()
          console.log('[Suno Webhook] Canción enviada por WhatsApp automáticamente:', {
            isPreview: sendSongData.isPreview,
            playUrl: sendSongData.playUrl,
          })
        } else {
          const errorData = await sendSongResponse.json().catch(() => ({}))
          console.error('[Suno Webhook] Error al enviar canción por WhatsApp:', {
            status: sendSongResponse.status,
            error: errorData,
          })
        }
      } catch (error) {
        console.error('[Suno Webhook] Excepción al enviar canción por WhatsApp:', error)
      }
    } else {
      console.log('[Suno Webhook] No se envió por WhatsApp: no hay número de WhatsApp registrado')
    }

    return NextResponse.json({
      success: true,
      message: "Orden actualizada exitosamente",
      orderId: order.id,
      audioUrl,
    })
  } catch (error) {
    console.error("[Suno Webhook] Error procesando callback:", error)
    // Responder 200 para que Suno no reintente en caso de errores de procesamiento
    return NextResponse.json(
      {
        success: false,
        error: `Error interno: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 200 }
    )
  }
}

// Permitir método GET para verificación
export async function GET(request: Request) {
  return NextResponse.json({
    success: true,
    message: "Suno webhook endpoint está activo",
    timestamp: new Date().toISOString(),
  })
}
