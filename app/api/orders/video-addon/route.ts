import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

// Precios del addon de video por moneda
const VIDEO_ADDON_PRICES: Record<string, number> = {
  MXN: 99,
  USD: 5,
  EUR: 5,
  COP: 23000,
  CLP: 8990,
  CRC: 2500,
  PEN: 18.50,
  ARS: 5000,
  PAB: 5,
  GTQ: 38,
  BRL: 28,
  UYU: 210,
  BOB: 34,
  PYG: 36000,
  DOP: 300,
  HNL: 123,
  NIO: 185,
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
  // Solo establecer headers CORS si el origen está presente y es permitido
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type")
    response.headers.set("Access-Control-Allow-Credentials", "false")
  }
  // Si el origen no está permitido o no está presente, no establecer headers CORS

  return response
}

/**
 * Handler para peticiones OPTIONS (preflight)
 * El navegador hace automáticamente esta petición antes de POST
 */
export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin")
  const response = new NextResponse(null, { status: 200 })
  return addCorsHeaders(response, origin)
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin")
  
  // Validar origen: si está presente pero no permitido, retornar 403
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json(
      { success: false, error: "Origen no autorizado" },
      { status: 403 }
    )
  }
  
  try {
    const body = await request.json()
    const { orderId, hasVideo } = body

    // Validar parámetros requeridos
    if (!orderId) {
      const response = NextResponse.json(
        { success: false, error: "orderId es requerido" },
        { status: 400 }
      )
      return addCorsHeaders(response, origin)
    }

    if (typeof hasVideo !== "boolean") {
      const response = NextResponse.json(
        { success: false, error: "hasVideo debe ser un valor booleano" },
        { status: 400 }
      )
      return addCorsHeaders(response, origin)
    }

    // Usar admin client para bypassing RLS
    if (!supabaseAdmin) {
      console.error("[Video Addon] supabaseAdmin not configured")
      const response = NextResponse.json(
        { success: false, error: "Error de configuración del servidor" },
        { status: 500 }
      )
      return addCorsHeaders(response, origin)
    }

    // Buscar la orden
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
    if (!VIDEO_ADDON_PRICES[currency]) {
      console.error("[Video Addon] Moneda no soportada:", currency)
      const response = NextResponse.json(
        { success: false, error: `Moneda no soportada: ${currency}` },
        { status: 400 }
      )
      return addCorsHeaders(response, origin)
    }

    // Obtener el precio del addon para esta moneda
    const addonPrice = VIDEO_ADDON_PRICES[currency]

    // Verificar si el estado actual coincide con el solicitado
    const currentVideoState = order.video ?? false
    if (currentVideoState === hasVideo) {
      // El estado ya coincide, retornar orden actual sin modificar
      const response = NextResponse.json({
        success: true,
        message: "El estado del addon de video ya coincide con el solicitado",
        order: {
          id: order.id,
          video: order.video,
          total_price: order.total_price,
          addons_total_price: order.addons_total_price ?? 0,
          currency: currency,
        },
      })
      return addCorsHeaders(response, origin)
    }

    // Calcular nuevos valores
    const currentTotalPrice = order.total_price ?? 0
    const currentAddonsTotal = order.addons_total_price ?? 0

    let newTotalPrice: number
    let newAddonsTotal: number
    let newVideoState: boolean

    if (hasVideo) {
      // Agregar addon
      newTotalPrice = currentTotalPrice + addonPrice
      newAddonsTotal = currentAddonsTotal + addonPrice
      newVideoState = true
    } else {
      // Remover addon
      newTotalPrice = Math.max(0, currentTotalPrice - addonPrice)
      newAddonsTotal = Math.max(0, currentAddonsTotal - addonPrice)
      newVideoState = false
    }

    // Actualizar la orden
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        video: newVideoState,
        total_price: newTotalPrice,
        addons_total_price: newAddonsTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .select()
      .single()

    if (updateError) {
      console.error("[Video Addon] Error al actualizar:", updateError)
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
      message: hasVideo
        ? `Addon de video agregado exitosamente (+${addonPrice} ${currency})`
        : `Addon de video removido exitosamente (-${addonPrice} ${currency})`,
      order: {
        id: updatedOrder.id,
        video: updatedOrder.video,
        total_price: updatedOrder.total_price,
        addons_total_price: updatedOrder.addons_total_price ?? 0,
        currency: currency,
        payment_status: updatedOrder.payment_status,
        status: updatedOrder.status,
      },
    })
    return addCorsHeaders(response, origin)
  } catch (error) {
    console.error("[Video Addon] Error:", error)
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

