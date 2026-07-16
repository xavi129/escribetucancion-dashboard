import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import Stripe from "stripe"

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const signature = request.headers.get("stripe-signature")

    if (!signature) {
      console.error("[Stripe Webhook] No signature header")
      return NextResponse.json(
        { success: false, error: "No signature header" },
        { status: 400 }
      )
    }

    // Verify webhook signature
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error("[Stripe Webhook] Signature verification failed:", err)
      return NextResponse.json(
        { success: false, error: "Invalid signature" },
        { status: 400 }
      )
    }

    console.log("[Stripe Webhook] Event received:", event.type)

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session

      const orderId = session.metadata?.order_id
      const transactionId = session.metadata?.transaction_id
      const customerWhatsapp = session.metadata?.customer_whatsapp
      const customerName = session.metadata?.customer_name

      console.log("[Stripe Webhook] Processing completed checkout:", {
        sessionId: session.id,
        orderId,
        transactionId,
        paymentStatus: session.payment_status,
      })

      if (!orderId) {
        console.error("[Stripe Webhook] No order_id in session metadata")
        return NextResponse.json(
          { success: false, error: "No order_id in metadata" },
          { status: 400 }
        )
      }

      // Use admin client for bypassing RLS
      if (!supabaseAdmin) {
        console.error("[Stripe Webhook] supabaseAdmin not configured")
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
        console.error("[Stripe Webhook] Error fetching order:", fetchError)
        return NextResponse.json(
          { success: false, error: "Order not found" },
          { status: 404 }
        )
      }

      const hasSpotifyUpload = existingOrder.spotify_upload === true
      const hasVideo = existingOrder.video === true

      console.log("[Stripe Webhook] Order flags:", {
        orderId,
        spotify_upload: hasSpotifyUpload,
        video: hasVideo,
      })

      // Determine the new status based on spotify_upload and video flags
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
        payment_method: "stripe",
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
        console.error("[Stripe Webhook] Error updating order:", updateError)
        return NextResponse.json(
          { success: false, error: "Error updating order" },
          { status: 500 }
        )
      }

      console.log("[Stripe Webhook] Order updated successfully:", {
        orderId: updatedOrder.id,
        paymentStatus: updatedOrder.payment_status,
        status: updatedOrder.status,
        spotify_upload: hasSpotifyUpload,
        video: hasVideo,
      })

      // Generate video if needed
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

        console.log("[Stripe Webhook] Calling video generation endpoint...")

        try {
          const videoResponse = await fetch(`${videoBaseUrl}/api/video/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId }),
          })

          if (videoResponse.ok) {
            const videoData = await videoResponse.json()
            console.log("[Stripe Webhook] Video generation initiated:", videoData)
          } else {
            const errorData = await videoResponse.json().catch(() => ({}))
            console.error("[Stripe Webhook] Error initiating video generation:", {
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

            console.log("[Stripe Webhook] Order status updated to failed_video_generation")
          }
        } catch (videoError) {
          console.error("[Stripe Webhook] Exception initiating video generation:", videoError)

          // Update order status to failed_video_generation
          await supabaseAdmin
            .from("orders")
            .update({
              status: "failed_video_generation",
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId)

          console.log("[Stripe Webhook] Order status updated to failed_video_generation due to exception")
        }
      }

      // Send WhatsApp notification using centralized send-song endpoint
      // This ensures multiple versions are handled correctly if they exist
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

          console.log("[Stripe Webhook] Sending WhatsApp notification via send-song endpoint...")
          
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
            console.log("[Stripe Webhook] WhatsApp notification sent successfully:", {
              hasMultipleVersions: sendSongData.hasMultipleVersions,
              playUrl: sendSongData.playUrl,
            })
          } else {
            const errorData = await whatsappResponse.json().catch(() => ({}))
            console.error("[Stripe Webhook] Error sending WhatsApp:", {
              status: whatsappResponse.status,
              error: errorData,
            })
          }
        } catch (whatsappError) {
          console.error("[Stripe Webhook] Exception sending WhatsApp:", whatsappError)
          // Don't fail the webhook for WhatsApp errors
        }
      } else {
        console.log("[Stripe Webhook] Skipping WhatsApp notification:", {
          hasWhatsapp: !!customerWhatsapp,
          hasAudioUrl: !!updatedOrder.audio_url,
        })
      }

      return NextResponse.json({ success: true, received: true })
    }

    // Handle other events if needed
    console.log("[Stripe Webhook] Unhandled event type:", event.type)
    return NextResponse.json({ success: true, received: true })
  } catch (error) {
    console.error("[Stripe Webhook] Error:", error)
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
    message: "Stripe webhook endpoint is active",
    timestamp: new Date().toISOString(),
  })
}
