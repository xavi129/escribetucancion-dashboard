import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

// Precios de upsells por moneda
const UPSELL_PRICES: Record<string, Record<string, number>> = {
  MXN: {
    express_delivery: 50,
    spotify_upload: 149,
    video_addon: 99,
  },
  USD: {
    express_delivery: 3,
    spotify_upload: 8,
    video_addon: 5,
  },
  EUR: {
    express_delivery: 3,
    spotify_upload: 8,
    video_addon: 5,
  },
  COP: {
    express_delivery: 15000,
    spotify_upload: 34000,
    video_addon: 23000,
  },
  CLP: {
    express_delivery: 2990,
    spotify_upload: 4990,
    video_addon: 8990,
  },
  CRC: {
    express_delivery: 1500,
    spotify_upload: 4500,
    video_addon: 2500,
  },
  PEN: {
    express_delivery: 11,
    spotify_upload: 33,
    video_addon: 18.50,
  },
  ARS: {
    express_delivery: 2500,
    spotify_upload: 9000,
    video_addon: 5000,
  },
  PAB: {
    express_delivery: 3,
    spotify_upload: 9,
    video_addon: 5,
  },
  GTQ: {
    express_delivery: 20,
    spotify_upload: 69,
    video_addon: 38,
  },
  BRL: {
    express_delivery: 15,
    spotify_upload: 52,
    video_addon: 28,
  },
  UYU: {
    express_delivery: 110,
    spotify_upload: 378,
    video_addon: 210,
  },
  BOB: {
    express_delivery: 18,
    spotify_upload: 62,
    video_addon: 34,
  },
  PYG: {
    express_delivery: 20000,
    spotify_upload: 66000,
    video_addon: 36000,
  },
  DOP: {
    express_delivery: 160,
    spotify_upload: 540,
    video_addon: 300,
  },
  HNL: {
    express_delivery: 65,
    spotify_upload: 222,
    video_addon: 123,
  },
  NIO: {
    express_delivery: 100,
    spotify_upload: 333,
    video_addon: 185,
  },
}

// Mapeo de tipo de upsell a campo de la orden
const UPSELL_FIELD_MAP: Record<string, string> = {
  express_delivery: "delivery_extra",
  spotify_upload: "spotify_upload",
  video_addon: "video", // El campo en la BD se llama "video", no "video_addon"
}

// Tipos de upsell válidos
type UpsellType = keyof typeof UPSELL_FIELD_MAP

/**
 * Función helper para agregar headers CORS a una respuesta
 * Permite orígenes específicos: worker melodia-agent y localhost
 */
function addCorsHeaders(response: NextResponse, origin?: string | null): NextResponse {
  const allowedOrigins = [
    "https://melodia-agent.sqentregas.workers.dev",
    "http://localhost:3002",
    "http://localhost:3000"
  ]
  
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin)
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  response.headers.set("Access-Control-Allow-Headers", "Content-Type")
  response.headers.set("Access-Control-Allow-Credentials", "false")
  return response
}

/**
 * Handler para peticiones OPTIONS (preflight)
 */
export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin")
  const response = new NextResponse(null, { status: 200 })
  return addCorsHeaders(response, origin)
}

/**
 * Endpoint para agregar upsells dinámicos a una orden
 * Los precios se calculan automáticamente según la moneda de la orden
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin")

  try {
    const body = await request.json()
    const { orderId, upsellType, enable = true } = body

    // Validaciones básicas
    if (!orderId) {
      const response = NextResponse.json(
        { success: false, error: "orderId es requerido" },
        { status: 400 }
      )
      return addCorsHeaders(response, origin)
    }

    if (!upsellType) {
      const response = NextResponse.json(
        { success: false, error: "upsellType es requerido" },
        { status: 400 }
      )
      return addCorsHeaders(response, origin)
    }

    // Validar que el tipo de upsell sea válido
    const validUpsellTypes = Object.keys(UPSELL_FIELD_MAP)
    if (!validUpsellTypes.includes(upsellType)) {
      const response = NextResponse.json(
        {
          success: false,
          error: `Tipo de upsell inválido. Tipos válidos: ${validUpsellTypes.join(", ")}`
        },
        { status: 400 }
      )
      return addCorsHeaders(response, origin)
    }

    if (!supabaseAdmin) {
      console.error("[Upsell] supabaseAdmin not configured")
      const response = NextResponse.json(
        { success: false, error: "Error de configuración del servidor" },
        { status: 500 }
      )
      return addCorsHeaders(response, origin)
    }

    // Obtener la orden actual
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      console.error("[Upsell] Error al obtener orden:", orderError)
      const response = NextResponse.json(
        { success: false, error: "Orden no encontrada" },
        { status: 404 }
      )
      return addCorsHeaders(response, origin)
    }

    // Verificar que la orden no esté pagada
    if (order.payment_status === "paid") {
      const response = NextResponse.json(
        { success: false, error: "No se pueden modificar upsells en órdenes pagadas" },
        { status: 400 }
      )
      return addCorsHeaders(response, origin)
    }

    // Obtener la moneda de la orden (default MXN)
    const currency = (order.currency || "MXN").toUpperCase()

    // Verificar que tengamos precios para esta moneda
    if (!UPSELL_PRICES[currency]) {
      console.error("[Upsell] Moneda no soportada:", currency)
      const response = NextResponse.json(
        { success: false, error: `Moneda no soportada: ${currency}` },
        { status: 400 }
      )
      return addCorsHeaders(response, origin)
    }

    // Obtener el precio del upsell para esta moneda
    const upsellPrice = UPSELL_PRICES[currency][upsellType as UpsellType]
    if (upsellPrice === undefined) {
      const response = NextResponse.json(
        { success: false, error: `Precio no definido para ${upsellType} en ${currency}` },
        { status: 400 }
      )
      return addCorsHeaders(response, origin)
    }

    // Obtener el campo correspondiente en la orden
    const orderField = UPSELL_FIELD_MAP[upsellType as UpsellType]

    // Verificar el estado actual del upsell
    // Para delivery_extra (numérico), verificamos si tiene un valor > 0
    // Para campos booleanos (spotify_upload, video_addon), verificamos el valor booleano
    let currentUpsellState: boolean
    if (orderField === "delivery_extra") {
      // delivery_extra es numérico: está activo si tiene un valor > 0
      currentUpsellState = (order[orderField] as number | null) !== null && (order[orderField] as number) > 0
    } else {
      // Campos booleanos
      currentUpsellState = (order[orderField] as boolean | null) ?? false
    }

    // Si el estado es el mismo, no hay cambios
    if (currentUpsellState === enable) {
      const response = NextResponse.json({
        success: true,
        message: "Sin cambios necesarios",
        order: {
          id: order.id,
          [orderField]: order[orderField],
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

    if (enable) {
      // Activar upsell: Sumar precio
      newTotalPrice = currentTotalPrice + upsellPrice
      newAddonsTotal = currentAddonsTotal + upsellPrice
    } else {
      // Desactivar upsell: Restar precio
      newTotalPrice = Math.max(0, currentTotalPrice - upsellPrice)
      newAddonsTotal = Math.max(0, currentAddonsTotal - upsellPrice)
    }

    // Preparar datos de actualización
    // Para delivery_extra (numérico), asignamos el precio o null
    // Para campos booleanos, asignamos true/false
    const updateData: Record<string, unknown> = {
      [orderField]: orderField === "delivery_extra" 
        ? (enable ? upsellPrice : null)
        : enable,
      total_price: newTotalPrice,
      addons_total_price: newAddonsTotal,
      updated_at: new Date().toISOString(),
    }

    // Si es express_delivery, actualizar también delivery_type
    if (upsellType === "express_delivery") {
      updateData.delivery_type = enable ? "express" : "standard"
    }

    // Actualizar la orden
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .select()
      .single()

    if (updateError) {
      console.error("[Upsell] Error al actualizar orden:", updateError)
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

    console.log("[Upsell] Actualizado exitosamente:", {
      orderId: orderId,
      upsellType: upsellType,
      enabled: enable,
      price: upsellPrice,
      currency: currency,
      newTotal: newTotalPrice,
    })

    const response = NextResponse.json({
      success: true,
      message: enable
        ? `${upsellType} activado exitosamente (+${upsellPrice} ${currency})`
        : `${upsellType} desactivado exitosamente (-${upsellPrice} ${currency})`,
      order: {
        id: updatedOrder.id,
        [orderField]: updatedOrder[orderField],
        total_price: updatedOrder.total_price,
        addons_total_price: updatedOrder.addons_total_price ?? 0,
        currency: currency,
        payment_status: updatedOrder.payment_status,
        status: updatedOrder.status,
        ...(upsellType === "express_delivery" && { delivery_type: updatedOrder.delivery_type }),
      },
      upsell: {
        type: upsellType,
        price: upsellPrice,
        currency: currency,
        enabled: enable,
      },
    })
    return addCorsHeaders(response, origin)

  } catch (error) {
    console.error("[Upsell] Error:", error)
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
