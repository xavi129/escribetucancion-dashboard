import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

// dLocal Go API configuration
const DLOCAL_API_URL = process.env.DLOCAL_ENV === "production"
  ? "https://api.dlocalgo.com"
  : "https://api-sbx.dlocalgo.com"

// CORS headers for play.escribetucancion.com
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://play.escribetucancion.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

// Handle OPTIONS preflight request
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

/**
 * Extract price from song_type format: "tipo - PRECIO CURRENCY"
 * Examples: "lite - 320 MXN" → 320, "premium - 100 USD" → 100, "lite - 50000 COP" → 50000
 * Supports: MXN, COP, BRL, ARS, CLP, PEN, USD, EUR, CRC, PAB, GTQ, UYU, BOB, PYG, DOP, HNL, NIO
 */
function extractPriceFromSongType(songType: string | null): number | null {
  if (!songType) return null

  // Match price followed by any supported currency code
  const match = songType.match(/(\d+(?:[\.,]\d+)?)\s*(MXN|COP|BRL|ARS|CLP|PEN|USD|EUR|CRC|PAB|GTQ|UYU|BOB|PYG|DOP|HNL|NIO)/i)
  if (match) {
    // Handle both dot and comma as decimal separators
    const priceStr = match[1].replace(',', '.')
    return parseFloat(priceStr)
  }
  return null
}

/**
 * Extract just the song type name without the price
 * Examples: "lite - 320 MXN" → "lite", "premium - 100 USD" → "premium"
 */
function extractSongTypeName(songType: string | null): string {
  if (!songType) return "Standard"

  // Remove the price and currency part (e.g., "- 320 MXN" or "- 50000 COP")
  const cleaned = songType.replace(/\s*-\s*\d+(?:[\.,]\d+)?\s*(MXN|COP|BRL|ARS|CLP|PEN|USD|EUR|CRC|PAB|GTQ|UYU|BOB|PYG|DOP|HNL|NIO)/i, "").trim()
  return cleaned || "Standard"
}

/**
 * Map currency code to dLocal Go country code
 * dLocal Go requires country to match currency in many cases
 */
function getCurrencyCountry(currency: string): string {
  const currencyCountryMap: Record<string, string> = {
    mxn: "MX",
    cop: "CO",
    brl: "BR",
    ars: "AR",
    clp: "CL",
    pen: "PE",
    usd: "US",
    eur: "ES",
    crc: "CR",
    pab: "PA",
    gtq: "GT",
    uyu: "UY",
    bob: "BO",
    pyg: "PY",
    dop: "DO",
    hnl: "HN",
    nio: "NI",
  }
  return currencyCountryMap[currency.toLowerCase()] || "MX"
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { order_id } = body

    if (!order_id) {
      return NextResponse.json(
        { success: false, error: "order_id es requerido" },
        { status: 400, headers: corsHeaders }
      )
    }

    // Validate dLocal Go credentials
    // Get these from: https://dashboard.dlocalgo.com → Integrations → API Integration
    // You need: API Key and Secret Key (NOT SmartFields API Key)
    const apiKey = process.env.DLOCAL_API_KEY
    const secretKey = process.env.DLOCAL_SECRET_KEY

    if (!apiKey || !secretKey) {
      console.error("[dLocal Checkout] Missing API credentials. Set DLOCAL_API_KEY and DLOCAL_SECRET_KEY")
      return NextResponse.json(
        { success: false, error: "Error de configuración del servidor" },
        { status: 500, headers: corsHeaders }
      )
    }

    // Log environment for debugging (without exposing secrets)
    console.log("[dLocal Checkout] Config:", {
      environment: process.env.DLOCAL_ENV || "sandbox",
      apiUrl: DLOCAL_API_URL,
      apiKeyLength: apiKey.length,
      secretKeyLength: secretKey.length,
    })

    // Use admin client for bypassing RLS
    if (!supabaseAdmin) {
      console.error("[dLocal Checkout] supabaseAdmin not configured")
      return NextResponse.json(
        { success: false, error: "Error de configuración del servidor" },
        { status: 500, headers: corsHeaders }
      )
    }

    // Try to find order by UUID first, then by transaction_id
    let order = null
    let error = null

    // Check if order_id looks like a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order_id)

    if (isUUID) {
      const result = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", order_id)
        .single()

      order = result.data
      error = result.error
    }

    // If not found by UUID or it's not a UUID, try by transaction_id
    if (!order) {
      const result = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("transaction_id", order_id)
        .single()

      order = result.data
      error = result.error
    }

    if (error || !order) {
      return NextResponse.json(
        { success: false, error: "Orden no encontrada" },
        { status: 404, headers: corsHeaders }
      )
    }

    // Check if order is already paid
    if (order.payment_status === "paid") {
      return NextResponse.json(
        { success: false, error: "Esta orden ya está pagada" },
        { status: 400, headers: corsHeaders }
      )
    }

    // Usar total_price de la orden (prioridad absoluta)
    // Si no está disponible, intentar extraerlo de song_type como fallback
    let price = order.total_price

    // Si total_price no está disponible o es 0, intentar extraer de song_type
    if (!price || price <= 0) {
      price = extractPriceFromSongType(order.song_type)
    }

    if (!price || price <= 0) {
      console.error("[dLocal Checkout] No se pudo determinar el precio:", {
        total_price: order.total_price,
        song_type: order.song_type,
      })
      return NextResponse.json(
        { success: false, error: "No se pudo determinar el precio de la orden. El total_price es requerido." },
        { status: 400, headers: corsHeaders }
      )
    }

    // Obtener la moneda de la orden, usar MXN como default
    const currency = (order.currency || "MXN").toUpperCase()
    const country = getCurrencyCountry(currency)

    // Build webhook URL for dLocal notifications
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://dash.escribetucancion.com"
    const notificationUrl = `${baseUrl}/api/dlocal/webhook`

    // Generate unique order_id for dLocal to allow multiple payment attempts
    // Format: {orderId}_{timestamp} - we'll extract the orderId in the webhook
    const timestamp = Date.now()
    const dlocalOrderId = `${order.id}_${timestamp}`

    // Create dLocal Go Payment
    // API reference: POST /v1/payments
    const dlocalPayload = {
      currency: currency,
      amount: price,
      country: country,
      order_id: dlocalOrderId,
      description: `Canción Personalizada - ${extractSongTypeName(order.song_type)} para ${order.customer_name || "Cliente"}`,
      success_url: `https://play.escribetucancion.com/play/${order.id}?payment=success`,
      back_url: `https://play.escribetucancion.com/preview/${order.id}?payment=cancelled`,
      notification_url: notificationUrl,
    }

    console.log("[dLocal Checkout] Creating payment:", {
      orderId: order.id,
      amount: price,
      currency: currency,
      country: country,
    })

    // Make request to dLocal Go API
    // Authorization: Bearer API_KEY:SECRET_KEY (as per dLocal Go documentation)
    const dlocalResponse = await fetch(`${DLOCAL_API_URL}/v1/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}:${secretKey}`,
      },
      body: JSON.stringify(dlocalPayload),
    })

    const dlocalData = await dlocalResponse.json()

    if (!dlocalResponse.ok) {
      console.error("[dLocal Checkout] API error:", {
        status: dlocalResponse.status,
        response: dlocalData,
      })
      return NextResponse.json(
        {
          success: false,
          error: `Error de dLocal: ${dlocalData.message || dlocalData.error || "Error desconocido"}`
        },
        { status: 500, headers: corsHeaders }
      )
    }

    console.log("[dLocal Checkout] Payment created:", {
      paymentId: dlocalData.id,
      orderId: order.id,
      amount: price,
      currency: currency,
      status: dlocalData.status,
      redirectUrl: dlocalData.redirect_url,
    })

    // Store dLocal payment ID in order for reference
    await supabaseAdmin
      .from("orders")
      .update({
        dlocal_payment_id: dlocalData.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)

    return NextResponse.json(
      {
        success: true,
        paymentId: dlocalData.id,
        url: dlocalData.redirect_url,
        // Include additional response data for compatibility
        sessionId: dlocalData.id,
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error("[dLocal Checkout] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: `Error al crear sesión de pago: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500, headers: corsHeaders }
    )
  }
}
