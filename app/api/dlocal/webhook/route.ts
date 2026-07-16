import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import crypto from "crypto"

// dLocal Go webhook secret for signature verification
const webhookSecret = process.env.DLOCAL_WEBHOOK_SECRET
const dlocalXLogin = process.env.DLOCAL_X_LOGIN

// dLocal Go API configuration
const DLOCAL_API_URL = process.env.DLOCAL_ENV === "production"
  ? "https://api.dlocalgo.com"
  : "https://api-sbx.dlocalgo.com"

/**
 * Extract the original order ID from dLocal's order_id
 * Format: {orderId}_{timestamp} → {orderId}
 * Example: "ff281669-d405-4ec5-8e83-909bc74de73c_1705825012345" → "ff281669-d405-4ec5-8e83-909bc74de73c"
 */
function extractOriginalOrderId(dlocalOrderId: string): string {
  if (!dlocalOrderId) return ""

  // Check if it's the new format with timestamp (contains underscore followed by digits at the end)
  const match = dlocalOrderId.match(/^(.+)_\d+$/)
  if (match) {
    return match[1]
  }

  // If no timestamp suffix, return as-is (backward compatibility)
  return dlocalOrderId
}

/**
 * Fetch payment details from dLocal Go API
 * Used when webhook only sends payment ID without full details
 */
async function fetchPaymentDetails(paymentId: string): Promise<{
  id: string
  status: string
  order_id: string
  amount: number
  currency: string
} | null> {
  const apiKey = process.env.DLOCAL_API_KEY
  const secretKey = process.env.DLOCAL_SECRET_KEY

  if (!apiKey || !secretKey) {
    console.error("[dLocal Webhook] Missing API credentials for fetching payment")
    return null
  }

  try {
    console.log("[dLocal Webhook] Fetching payment details from API:", paymentId)

    const response = await fetch(`${DLOCAL_API_URL}/v1/payments/${paymentId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}:${secretKey}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      console.error("[dLocal Webhook] Error fetching payment:", {
        status: response.status,
        statusText: response.statusText,
      })
      return null
    }

    const data = await response.json()
    console.log("[dLocal Webhook] Payment details fetched:", JSON.stringify(data, null, 2))

    // Extract original order ID from dLocal's order_id (format: {orderId}_{timestamp})
    const dlocalOrderId = data.order_id || data.external_reference
    return {
      id: data.id,
      status: (data.status || "").toUpperCase(),
      order_id: extractOriginalOrderId(dlocalOrderId),
      amount: data.amount,
      currency: data.currency,
    }
  } catch (error) {
    console.error("[dLocal Webhook] Exception fetching payment:", error)
    return null
  }
}

/**
 * Verify dLocal webhook signature using HMAC-SHA256
 * dLocal signs notifications using: HMAC-SHA256(X-Login + X-Date + RequestBody, secretKey)
 */
function verifyDlocalSignature(
  body: string,
  authHeader: string | null,
  xDateHeader: string | null
): boolean {
  if (!webhookSecret || !dlocalXLogin) {
    console.error("[dLocal Webhook] Missing webhook secret or X-Login configuration")
    return false
  }

  if (!authHeader || !xDateHeader) {
    console.error("[dLocal Webhook] Missing Authorization or X-Date header")
    return false
  }

  // Extract signature from Authorization header
  // Format: V2-HMAC-SHA256, Signature: {signature}
  const signatureMatch = authHeader.match(/Signature:\s*([a-f0-9]+)/i)
  if (!signatureMatch) {
    console.error("[dLocal Webhook] Invalid Authorization header format")
    return false
  }

  const receivedSignature = signatureMatch[1]

  // Compute expected signature: HMAC-SHA256(X-Login + X-Date + RequestBody, secretKey)
  const message = dlocalXLogin + xDateHeader + body
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(message)
    .digest("hex")

  // Compare signatures (timing-safe comparison)
  try {
    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature, "hex"),
      Buffer.from(expectedSignature, "hex")
    )
  } catch {
    return false
  }
}

// dLocal payment status types
type DlocalPaymentStatus = "PENDING" | "PAID" | "REJECTED" | "CANCELLED" | "EXPIRED"

interface DlocalWebhookPayload {
  id: string
  amount: number
  status: DlocalPaymentStatus
  status_detail?: string
  status_code?: string
  currency: string
  country: string
  payment_method_id?: string
  payment_method_type?: string
  payment_method_flow?: string
  payer?: {
    name?: string
    email?: string
    phone?: string
    user_reference?: string
  }
  order_id: string
  notification_url?: string
  created_date: string
}

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const authHeader = request.headers.get("authorization")
    const xDateHeader = request.headers.get("x-date")

    // Log raw payload for debugging
    console.log("[dLocal Webhook] Raw body received:", body)
    console.log("[dLocal Webhook] Headers:", {
      authorization: authHeader ? "present" : "missing",
      xDate: xDateHeader,
      contentType: request.headers.get("content-type"),
    })

    // Verify webhook signature
    // Note: In sandbox/development, you may want to skip verification for testing
    const skipVerification = process.env.DLOCAL_SKIP_WEBHOOK_VERIFICATION === "true"

    if (!skipVerification && !verifyDlocalSignature(body, authHeader, xDateHeader)) {
      console.error("[dLocal Webhook] Signature verification failed")
      return NextResponse.json(
        { success: false, error: "Invalid signature" },
        { status: 400 }
      )
    }

    // Parse the payload - dLocal Go may send different formats:
    // 1. Full JSON object with all payment details
    // 2. JSON object with just payment_id or id
    // 3. Plain string with just the payment ID
    let rawPayload: Record<string, unknown> = {}
    let paymentId: string | null = null

    try {
      // Try to parse as JSON first
      rawPayload = JSON.parse(body)
      console.log("[dLocal Webhook] Full parsed payload:", JSON.stringify(rawPayload, null, 2))

      // Extract payment ID from various possible fields
      paymentId = (rawPayload.id || rawPayload.payment_id || rawPayload.paymentId) as string
    } catch {
      // If not JSON, the body might be just the payment ID as a string
      console.log("[dLocal Webhook] Body is not JSON, treating as payment ID string")
      paymentId = body.trim()
    }

    // Map dLocal Go fields to our expected structure
    // Extract original order ID from dLocal's order_id (format: {orderId}_{timestamp})
    const dlocalOrderId = (rawPayload.order_id || rawPayload.orderId || rawPayload.merchant_order_id || rawPayload.external_reference) as string
    let payload = {
      id: paymentId,
      status: ((rawPayload.status || rawPayload.payment_status || rawPayload.paymentStatus || "") as string).toUpperCase(),
      order_id: extractOriginalOrderId(dlocalOrderId),
      amount: rawPayload.amount as number,
      currency: rawPayload.currency as string,
      status_detail: (rawPayload.status_detail || rawPayload.statusDetail) as string,
    }

    console.log("[dLocal Webhook] Initial mapped payload:", {
      paymentId: payload.id,
      status: payload.status,
      orderId: payload.order_id,
      amount: payload.amount,
    })

    // If we don't have status or order_id, fetch payment details from API
    // dLocal Go sometimes only sends the payment ID in the webhook
    if (paymentId && (!payload.status || !payload.order_id)) {
      console.log("[dLocal Webhook] Missing status or order_id, fetching from API...")

      const paymentDetails = await fetchPaymentDetails(paymentId)

      if (paymentDetails) {
        payload = {
          ...payload,
          id: paymentDetails.id,
          status: paymentDetails.status,
          order_id: paymentDetails.order_id,
          amount: paymentDetails.amount,
          currency: paymentDetails.currency,
        }
        console.log("[dLocal Webhook] Updated payload from API:", {
          paymentId: payload.id,
          status: payload.status,
          orderId: payload.order_id,
          amount: payload.amount,
        })
      } else {
        console.error("[dLocal Webhook] Could not fetch payment details")
        return NextResponse.json(
          { success: false, error: "Could not fetch payment details" },
          { status: 500 }
        )
      }
    }

    // Handle PAID status (equivalent to Stripe's checkout.session.completed)
    if (payload.status === "PAID") {
      const orderId = payload.order_id

      console.log("[dLocal Webhook] Processing completed payment:", {
        paymentId: payload.id,
        orderId,
        status: payload.status,
        amount: payload.amount,
        currency: payload.currency,
      })

      if (!orderId) {
        console.error("[dLocal Webhook] No order_id in webhook payload")
        return NextResponse.json(
          { success: false, error: "No order_id in payload" },
          { status: 400 }
        )
      }

      // Use admin client for bypassing RLS
      if (!supabaseAdmin) {
        console.error("[dLocal Webhook] supabaseAdmin not configured")
        return NextResponse.json(
          { success: false, error: "Server configuration error" },
          { status: 500 }
        )
      }

      // First, fetch the order to get spotify_upload and video flags
      const { data: existingOrder, error: fetchError } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single()

      if (fetchError || !existingOrder) {
        console.error("[dLocal Webhook] Error fetching order:", fetchError)
        return NextResponse.json(
          { success: false, error: "Order not found" },
          { status: 404 }
        )
      }

      // Idempotency check: if order is already paid, skip processing to avoid duplicates
      // dLocal may send duplicate webhooks to ensure delivery
      if (existingOrder.payment_status === "paid") {
        console.log("[dLocal Webhook] Order already paid, skipping duplicate webhook:", {
          orderId,
          paymentId: payload.id,
        })
        return NextResponse.json({ success: true, received: true, skipped: "already_paid" })
      }

      const hasSpotifyUpload = existingOrder.spotify_upload === true
      const hasVideo = existingOrder.video === true
      const customerWhatsapp = existingOrder.whatsapp

      console.log("[dLocal Webhook] Order flags:", {
        orderId,
        spotify_upload: hasSpotifyUpload,
        video: hasVideo,
      })

      // Determine the new status based on spotify_upload and video flags
      // This logic is identical to the Stripe webhook (lines 97-115)
      let newStatus: string
      let shouldGenerateVideo = false

      if (hasSpotifyUpload && hasVideo) {
        // Both flags: generate video and set status to upload_spotify
        newStatus = "upload_spotify"
        shouldGenerateVideo = true
      } else if (hasSpotifyUpload) {
        // Only spotify_upload: set status to upload_spotify
        newStatus = "upload_spotify"
      } else if (hasVideo) {
        // Only video: generate video, video webhook will update to completed when done
        newStatus = "generating_video"
        shouldGenerateVideo = true
      } else {
        // Neither flag: mark as completed
        newStatus = "completed"
      }

      // Update order status
      const updateData: Record<string, unknown> = {
        payment_status: "paid",
        status: newStatus,
        payment_method: "dlocal",
        dlocal_payment_id: payload.id,
        updated_at: new Date().toISOString(),
      }

      // Only set completed_at if status is completed
      if (newStatus === "completed") {
        updateData.completed_at = new Date().toISOString()
      }

      const { data: updatedOrder, error: updateError } = await supabaseAdmin
        .from("orders")
        .update(updateData)
        .eq("id", orderId)
        .select()
        .single()

      if (updateError) {
        console.error("[dLocal Webhook] Error updating order:", updateError)
        return NextResponse.json(
          { success: false, error: "Error updating order" },
          { status: 500 }
        )
      }

      console.log("[dLocal Webhook] Order updated successfully:", {
        orderId: updatedOrder.id,
        paymentStatus: updatedOrder.payment_status,
        status: updatedOrder.status,
        spotify_upload: hasSpotifyUpload,
        video: hasVideo,
      })

      // Generate video if needed (identical to Stripe webhook lines 153-216)
      if (shouldGenerateVideo) {
        // Build internal API URL
        let videoBaseUrl = process.env.NEXT_PUBLIC_BASE_URL
        if (!videoBaseUrl) {
          const host = request.headers.get("host")
          const allowedHosts = [
            "dash.escribetucancion.com",
            "localhost:3000",
            "localhost"
          ]

          if (host && allowedHosts.some(allowed => host === allowed || host.startsWith(`${allowed}:`))) {
            const protocol = request.headers.get("x-forwarded-proto") || "https"
            videoBaseUrl = `${protocol}://${host}`
          } else {
            videoBaseUrl = "https://dash.escribetucancion.com"
          }
        }

        console.log("[dLocal Webhook] Calling video generation endpoint...")

        try {
          const videoResponse = await fetch(`${videoBaseUrl}/api/video/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId }),
          })

          if (videoResponse.ok) {
            const videoData = await videoResponse.json()
            console.log("[dLocal Webhook] Video generation initiated:", videoData)
          } else {
            const errorData = await videoResponse.json().catch(() => ({}))
            console.error("[dLocal Webhook] Error initiating video generation:", {
              status: videoResponse.status,
              error: errorData,
            })

            // Update order status to failed_video_generation
            await supabaseAdmin
              .from("orders")
              .update({
                status: "failed_video_generation",
                updated_at: new Date().toISOString(),
              })
              .eq("id", orderId)

            console.log("[dLocal Webhook] Order status updated to failed_video_generation")
          }
        } catch (videoError) {
          console.error("[dLocal Webhook] Exception initiating video generation:", videoError)

          // Update order status to failed_video_generation
          await supabaseAdmin
            .from("orders")
            .update({
              status: "failed_video_generation",
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId)

          console.log("[dLocal Webhook] Order status updated to failed_video_generation due to exception")
        }
      }

      // Send WhatsApp notification using centralized send-song endpoint
      // This ensures multiple versions are handled correctly if they exist
      // Mirrors the Stripe webhook's centralized WhatsApp notification flow
      if (customerWhatsapp && updatedOrder.audio_url) {
        try {
          // Build internal API URL using environment variable or validated host
          let baseUrl = process.env.NEXT_PUBLIC_BASE_URL
          if (!baseUrl) {
            // Validate host against allowed domains to prevent host header injection
            const host = request.headers.get("host")
            const allowedHosts = [
              "dash.escribetucancion.com",
              "localhost:3000",
              "localhost"
            ]

            if (host && allowedHosts.some(allowed => host === allowed || host.startsWith(`${allowed}:`))) {
              const protocol = request.headers.get("x-forwarded-proto") || "https"
              baseUrl = `${protocol}://${host}`
            } else {
              // Default fallback
              baseUrl = "https://dash.escribetucancion.com"
            }
          }

          console.log("[dLocal Webhook] Sending WhatsApp notification via send-song endpoint...")

          // Use the centralized send-song endpoint which handles multiple versions automatically
          const whatsappResponse = await fetch(`${baseUrl}/api/whatsapp/send-song`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: orderId,
            }),
          })

          if (whatsappResponse.ok) {
            const sendSongData = await whatsappResponse.json()
            console.log("[dLocal Webhook] WhatsApp notification sent successfully:", {
              hasMultipleVersions: sendSongData.hasMultipleVersions,
              playUrl: sendSongData.playUrl,
            })
          } else {
            const errorData = await whatsappResponse.json().catch(() => ({}))
            console.error("[dLocal Webhook] Error sending WhatsApp:", {
              status: whatsappResponse.status,
              error: errorData,
            })
          }
        } catch (whatsappError) {
          console.error("[dLocal Webhook] Exception sending WhatsApp:", whatsappError)
          // Don't fail the webhook for WhatsApp errors
        }
      } else {
        console.log("[dLocal Webhook] Skipping WhatsApp notification:", {
          hasWhatsapp: !!customerWhatsapp,
          hasAudioUrl: !!updatedOrder.audio_url,
        })
      }

      return NextResponse.json({ success: true, received: true })
    }

    // Handle other statuses (REJECTED, CANCELLED, EXPIRED, PENDING)
    if (payload.status === "REJECTED" || payload.status === "CANCELLED" || payload.status === "EXPIRED") {
      const orderId = payload.order_id

      if (orderId && supabaseAdmin) {
        console.log("[dLocal Webhook] Payment failed/cancelled:", {
          paymentId: payload.id,
          orderId,
          status: payload.status,
          statusDetail: payload.status_detail,
        })

        // Update order to reflect payment failure
        await supabaseAdmin
          .from("orders")
          .update({
            payment_status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId)
      }
    }

    // Handle PENDING status - just log, no action needed
    if (payload.status === "PENDING") {
      console.log("[dLocal Webhook] Payment pending:", {
        paymentId: payload.id,
        orderId: payload.order_id,
      })
    }

    console.log("[dLocal Webhook] Event processed:", payload.status)
    return NextResponse.json({ success: true, received: true })
  } catch (error) {
    console.error("[dLocal Webhook] Error:", error)
    return NextResponse.json(
      { success: false, error: "Webhook handler error" },
      { status: 500 }
    )
  }
}

// Verify webhook is active
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "dLocal webhook endpoint is active",
    timestamp: new Date().toISOString(),
  })
}
