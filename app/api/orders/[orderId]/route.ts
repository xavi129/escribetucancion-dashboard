import { NextResponse, NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

// CORS headers for play.escribetucancion.com
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId es requerido" },
        { status: 400, headers: corsHeaders }
      )
    }

    // Use admin client for bypassing RLS
    if (!supabaseAdmin) {
      console.error("[Orders API] supabaseAdmin not configured")
      return NextResponse.json(
        { success: false, error: "Error de configuración del servidor" },
        { status: 500, headers: corsHeaders }
      )
    }

    // Try to find order by UUID first, then by transaction_id
    let order = null
    let error = null

    // Check if orderId looks like a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)

    if (isUUID) {
      // Search by UUID id
      const result = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single()
      
      order = result.data
      error = result.error
    }

    // If not found by UUID or it's not a UUID, try by transaction_id
    if (!order) {
      const result = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("transaction_id", orderId)
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

    // Extract price from song_type if total_price is null
    const totalPrice = order.total_price ?? extractPriceFromSongType(order.song_type)

    // Determine if there are multiple versions
    const hasMultipleVersions = !!(order.audio_url_alt && order.audio_url_alt.trim() !== "")
    
    // Build array of audio URLs (for future use in player)
    const audioUrls: string[] = []
    if (order.audio_url) {
      audioUrls.push(order.audio_url)
    }
    if (order.audio_url_alt) {
      audioUrls.push(order.audio_url_alt)
    }

    // Build array of image URLs (for player artwork)
    const imageUrls: string[] = []
    if (order.image_url) {
      imageUrls.push(order.image_url)
    }
    if (order.image_url_alt) {
      imageUrls.push(order.image_url_alt)
    }

    // Return only public data needed by the player
    const publicData = {
      id: order.id,
      transaction_id: order.transaction_id,
      customer_name: order.customer_name,
      song_type: order.song_type,
      audio_url: order.audio_url, // Always first version for backward compatibility
      audio_url_alt: order.audio_url_alt ?? null,
      has_multiple_versions: hasMultipleVersions,
      audio_urls: audioUrls,
      image_url: order.image_url ?? null, // Cover art for first version
      image_url_alt: order.image_url_alt ?? null, // Cover art for second version
      image_urls: imageUrls, // Array of all cover art URLs
      total_price: totalPrice,
      currency: order.currency || "MXN", // ISO 4217 currency code
      payment_status: order.payment_status,
      status: order.status,
      whatsapp: order.whatsapp,
      spotify_song_name: order.spotify_song_name ?? null,
      person_name: order.person_name ?? null,
      include_name: order.include_name ?? false,
      video: order.video ?? false, // Indica si el addon de video ya fue seleccionado
      spotify_upload: order.spotify_upload ?? false, // Indica si el addon de Spotify ya fue seleccionado

      // === Campos para /modify route ===
      // Estos campos son necesarios para la edición de canciones
      occasion: order.occasion ?? null,
      details: order.details ?? null,
      style: order.styles || order.genre || null, // Estilo musical
      mood: order.purpose ?? null, // Estado de ánimo / propósito
      genre: order.genre ?? null,
      voice_gender: order.voice_gender ?? null,
      relationship: order.relationship ?? null,
      song_references: order.song_references ?? null, // Canción de referencia

      // Letra y estilo: siempre incluidos para permitir preview antes de pagar
      generated_lyric: order.generated_lyric ?? null,
      generated_style: order.generated_style ?? null,
      tags: order.generated_style ?? null, // Alias para compatibilidad

      // IDs de Suno para edición (solo órdenes pagadas)
      ...(order.payment_status === "paid" && {
        suno_audio_id: order.suno_audio_id ?? null,
        suno_task_id: order.suno_task_id ?? null,
      }),

      // Contador de ediciones usadas (para mostrar límite en el frontend)
      edits_used: (order as any).edits_used ?? 0,
    }

    return NextResponse.json(
      { success: true, data: publicData },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error("[Orders API] Error:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500, headers: corsHeaders }
    )
  }
}
