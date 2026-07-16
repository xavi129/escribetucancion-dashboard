import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import Stripe from "stripe"

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
})

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
 * Example: "lite - 320 MXN" → 320, "premium - 50000 COP" → 50000
 */
function extractPriceFromSongType(songType: string | null): number | null {
  if (!songType) return null

  const match = songType.match(/(\d+(?:[\.,]\d+)?)\s*(MXN|COP|BRL|ARS|CLP|PEN|USD|EUR|CRC|PAB|GTQ|UYU|BOB|PYG|DOP|HNL|NIO)/i)
  if (match) {
    const priceStr = match[1].replace(',', '.')
    return parseFloat(priceStr)
  }
  return null
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

    // Use admin client for bypassing RLS
    if (!supabaseAdmin) {
      console.error("[Stripe Checkout] supabaseAdmin not configured")
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
      console.error("[Stripe Checkout] No se pudo determinar el precio:", {
        total_price: order.total_price,
        song_type: order.song_type,
      })
      return NextResponse.json(
        { success: false, error: "No se pudo determinar el precio de la orden. El total_price es requerido." },
        { status: 400, headers: corsHeaders }
      )
    }

    // Obtener la moneda de la orden, usar MXN como default
    const currency = (order.currency || "mxn").toLowerCase()

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      currency: currency,
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: `Canción Personalizada - ${order.song_type || "Standard"}`,
              description: `Pedido para ${order.customer_name || "Cliente"}`,
            },
            unit_amount: price * 100, // Stripe expects amounts in cents
          },
          quantity: 1,
        },
      ],
      success_url: `https://play.escribetucancion.com/play/${order.id}?payment=success`,
      cancel_url: `https://play.escribetucancion.com/preview/${order.id}?payment=cancelled`,
      metadata: {
        order_id: order.id,
        transaction_id: order.transaction_id || "",
        customer_whatsapp: order.whatsapp || "",
        customer_name: order.customer_name || "",
      },
    })

    console.log("[Stripe Checkout] Session created:", {
      sessionId: session.id,
      orderId: order.id,
      amount: price,
      currency: currency,
    })

    return NextResponse.json(
      {
        success: true,
        sessionId: session.id,
        url: session.url,
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error("[Stripe Checkout] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: `Error al crear sesión de pago: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500, headers: corsHeaders }
    )
  }
}
