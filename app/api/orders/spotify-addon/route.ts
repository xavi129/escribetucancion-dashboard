import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

// Precios del addon de Spotify por moneda
const SPOTIFY_ADDON_PRICES: Record<string, number> = {
  MXN: 149,
  USD: 8,
  EUR: 8,
  COP: 34000,
  CLP: 4990,
  CRC: 4500,
  PEN: 33,
  ARS: 9000,
  PAB: 9,
  GTQ: 69,
  BRL: 52,
  UYU: 378,
  BOB: 62,
  PYG: 66000,
  DOP: 540,
  HNL: 222,
  NIO: 333,
}

// Orígenes permitidos para CORS
const ALLOWED_ORIGINS = [
  "https://play.escribetucancion.com",
  "http://localhost:3000",
]

/**
 * Función helper para agregar headers CORS a una respuesta
 * Solo establece headers CORS si el origen está presente y es permitido
 */
function addCorsHeaders(response: NextResponse, origin?: string | null): NextResponse {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type")
    response.headers.set("Access-Control-Allow-Credentials", "false")
  }
  return response
}

/**
 * Valida el nombre de la canción según las reglas de Spotify
 * Retorna null si es válido, o un mensaje de error si no lo es
 */
function validateSongName(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return "El nombre de la canción es requerido"
  }

  const cleanName = name.trim()

  // 1. Información adicional innecesaria / Cosas extrañas entre paréntesis
  // Detecta paréntesis, corchetes o llaves que contengan texto
  if (/[\(\[\{].*[\)\]\}]/.test(cleanName)) {
    return "El nombre no puede contener información entre paréntesis, corchetes o llaves"
  }

  // 2. Puntuación rara
  // Permitimos caracteres alfanuméricos básicos, espacios y puntuación común (., - ! ?) en español
  // Bloqueamos símbolos raros, emojis, etc.
  // Regex: ^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\.,!\?\-]+$
  if (!/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\.,!\?\-']+$/.test(cleanName)) {
    return "El nombre contiene caracteres o puntuación no permitida"
  }

  // 3. Fechas o años
  // Detecta años de 4 dígitos (19xx o 20xx)
  if (/(19|20)\d{2}/.test(cleanName)) {
    return "El nombre no puede contener años o fechas"
  }

  // 4. URLs, información de contacto, redes sociales
  if (/(https?:\/\/|www\.|@|\.com|\.net|\.org)/i.test(cleanName)) {
    return "El nombre no puede contener URLs, emails o redes sociales"
  }

  // 5. La palabra "Oficial"
  if (/\bOficial\b/i.test(cleanName)) {
    return "El nombre no puede contener la palabra 'Oficial'"
  }

  // Extra: Nombres de servicios de streaming
  if (/\b(Spotify|Apple Music|YouTube|SoundCloud|Deezer|Amazon Music)\b/i.test(cleanName)) {
    return "El nombre no puede contener nombres de plataformas de streaming"
  }

  return null
}

/**
 * Handler para peticiones OPTIONS (preflight)
 */
export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin")
  const response = new NextResponse(null, { status: 200 })
  return addCorsHeaders(response, origin)
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin")

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json(
      { success: false, error: "Origen no autorizado" },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { orderId, hasSpotify, songName } = body

    // Validaciones básicas
    if (!orderId) {
      const response = NextResponse.json(
        { success: false, error: "orderId es requerido" },
        { status: 400 }
      )
      return addCorsHeaders(response, origin)
    }

    if (typeof hasSpotify !== "boolean") {
      const response = NextResponse.json(
        { success: false, error: "hasSpotify debe ser un valor booleano" },
        { status: 400 }
      )
      return addCorsHeaders(response, origin)
    }

    if (hasSpotify && !songName) {
      const response = NextResponse.json(
        { success: false, error: "El nombre de la canción es requerido para activar Spotify" },
        { status: 400 }
      )
      return addCorsHeaders(response, origin)
    }

    // Validar el formato del nombre de la canción
    if (hasSpotify && songName) {
      const validationError = validateSongName(songName)
      if (validationError) {
        const response = NextResponse.json(
          { success: false, error: validationError },
          { status: 400 }
        )
        return addCorsHeaders(response, origin)
      }
    }

    if (!supabaseAdmin) {
      console.error("[Spotify Addon] supabaseAdmin not configured")
      const response = NextResponse.json(
        { success: false, error: "Error de configuración del servidor" },
        { status: 500 }
      )
      return addCorsHeaders(response, origin)
    }

    // Validar unicidad del nombre en la base de datos
    if (hasSpotify && songName) {
      const cleanSongName = songName.trim()

      const { data: existingOrders, error: uniquenessError } = await supabaseAdmin
        .from("orders")
        .select("id")
        .ilike("spotify_song_name", cleanSongName)
        .neq("status", "cancelled") // Ignorar órdenes canceladas
        .neq("id", orderId) // Ignorar la orden actual (permitir actualizaciones)
        .limit(1)

      if (uniquenessError) {
        console.error("[Spotify Addon] Error verificando unicidad:", uniquenessError)
        const response = NextResponse.json(
          { success: false, error: "Error verificando disponibilidad del nombre" },
          { status: 500 }
        )
        return addCorsHeaders(response, origin)
      }

      if (existingOrders && existingOrders.length > 0) {
        const response = NextResponse.json(
          { success: false, error: "Este nombre de canción ya está en uso" },
          { status: 400 }
        )
        return addCorsHeaders(response, origin)
      }
    }

    // Buscar la orden actual
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      const response = NextResponse.json(
        { success: false, error: "Orden no encontrada" },
        { status: 404 }
      )
      return addCorsHeaders(response, origin)
    }

    // Obtener la moneda de la orden (default MXN)
    const currency = (order.currency || "MXN").toUpperCase()

    // Verificar que tengamos precios para esta moneda
    if (!SPOTIFY_ADDON_PRICES[currency]) {
      console.error("[Spotify Addon] Moneda no soportada:", currency)
      const response = NextResponse.json(
        { success: false, error: `Moneda no soportada: ${currency}` },
        { status: 400 }
      )
      return addCorsHeaders(response, origin)
    }

    // Obtener el precio del addon para esta moneda
    const addonPrice = SPOTIFY_ADDON_PRICES[currency]

    // Verificar cambios
    const currentSpotifyState = order.spotify_upload ?? false
    const currentSongName = order.spotify_song_name
    const newSongName = hasSpotify ? songName.trim() : currentSongName // Preservar nombre al desactivar

    // Si no hay cambio en el estado del toggle Y no hay cambio en el nombre (o el nombre es irrelevante porque está desactivado)
    // Entonces no hacemos nada.
    // Pero si el usuario envía hasSpotify=true y un nombre diferente, debemos actualizar.
    const isToggleSame = currentSpotifyState === hasSpotify
    const isNameSame = currentSongName === newSongName

    // Caso especial: Si está activo y solo cambia el nombre, debemos actualizar.
    // Si el estado es el mismo y (está desactivado O el nombre es igual), retornamos sin cambios.
    if (isToggleSame && (!hasSpotify || isNameSame)) {
      const response = NextResponse.json({
        success: true,
        message: "Sin cambios necesarios",
        order: {
          id: order.id,
          spotify_upload: order.spotify_upload,
          total_price: order.total_price,
          addons_total_price: order.addons_total_price ?? 0,
          currency: currency,
        },
      })
      return addCorsHeaders(response, origin)
    }

    // Calcular nuevos precios
    const currentTotalPrice = order.total_price ?? 0
    const currentAddonsTotal = order.addons_total_price ?? 0

    let newTotalPrice: number
    let newAddonsTotal: number

    // Solo ajustamos precio si cambia el estado del toggle
    if (hasSpotify && !currentSpotifyState) {
      // Activar: Sumar precio
      newTotalPrice = currentTotalPrice + addonPrice
      newAddonsTotal = currentAddonsTotal + addonPrice
    } else if (!hasSpotify && currentSpotifyState) {
      // Desactivar: Restar precio
      newTotalPrice = Math.max(0, currentTotalPrice - addonPrice)
      newAddonsTotal = Math.max(0, currentAddonsTotal - addonPrice)
    } else {
      // Solo cambio de nombre, precio igual
      newTotalPrice = currentTotalPrice
      newAddonsTotal = currentAddonsTotal
    }

    // Actualizar orden
    const updateData: any = {
      spotify_upload: hasSpotify,
      total_price: newTotalPrice,
      addons_total_price: newAddonsTotal,
      updated_at: new Date().toISOString(),
    }

    // Solo actualizar el nombre si se proporciona (preservar el existente si se desactiva)
    if (hasSpotify) {
      updateData.spotify_song_name = newSongName
    }

    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from("orders")
      .update(updateData)
      .eq("id", order.id)
      .select()
      .single()

    if (updateError) {
      console.error("[Spotify Addon] Error al actualizar:", updateError)
      const response = NextResponse.json(
        {
          success: false,
          error: "Error al actualizar la orden",
          details: updateError.message,
        },
        { status: 500 }
      )
      return addCorsHeaders(response, origin)
    }

    const response = NextResponse.json({
      success: true,
      message: hasSpotify
        ? `Addon de Spotify actualizado exitosamente (+${addonPrice} ${currency})`
        : `Addon de Spotify removido exitosamente (-${addonPrice} ${currency})`,
      order: {
        id: updatedOrder.id,
        spotify_upload: updatedOrder.spotify_upload,
        total_price: updatedOrder.total_price,
        addons_total_price: updatedOrder.addons_total_price ?? 0,
        currency: currency,
        spotify_song_name: updatedOrder.spotify_song_name,
        payment_status: updatedOrder.payment_status,
        status: updatedOrder.status,
      },
    })
    return addCorsHeaders(response, origin)

  } catch (error) {
    console.error("[Spotify Addon] Error:", error)
    const response = NextResponse.json(
      {
        success: false,
        error: `Error interno del servidor: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    )
    return addCorsHeaders(response, origin)
  }
}
