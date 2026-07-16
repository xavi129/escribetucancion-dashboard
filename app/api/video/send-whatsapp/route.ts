import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Send Video Link via WhatsApp
 * 
 * Used to manually send the video link to the customer
 * when the automatic callback notification failed
 */
export async function POST(request: NextRequest) {
  try {
    const { orderId, videoUrl } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId is required' },
        { status: 400 }
      );
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (!order.whatsapp) {
      return NextResponse.json(
        { error: 'Order does not have a WhatsApp number' },
        { status: 400 }
      );
    }

    // Use provided videoUrl or get from order
    const finalVideoUrl = videoUrl || order.video_url;

    if (!finalVideoUrl) {
      return NextResponse.json(
        { error: 'No video URL available' },
        { status: 400 }
      );
    }

    // Send WhatsApp message
    const whatsappMessage = `🎬 ¡Tu video musical está listo! 🎵

Hola ${order.customer_name}, 

Tu canción "${order.spotify_song_name || 'Tu Canción Personalizada'}" ahora tiene su propio video musical.

🔗 Ver tu video: ${finalVideoUrl}

⚠️ Importante: Este enlace estará disponible por 14 días. Te recomendamos descargarlo pronto.

¡Esperamos que disfrutes tu video musical personalizado!

Equipo Escribe Tu Canción 🎼`;

    // Use absolute URL with fallback
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
    const response = await fetch(`${baseUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: order.whatsapp,
        messageBody: whatsappMessage
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'Failed to send WhatsApp message',
        details: responseData
      });
    }

    // Update order video_url if it was provided and different
    if (videoUrl && videoUrl !== order.video_url) {
      await supabase
        .from('orders')
        .update({
          video_url: videoUrl,
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
    } else {
      // Mark as completed even if video_url didn't change
      await supabase
        .from('orders')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
    }

    return NextResponse.json({
      success: true,
      message: 'Video link sent via WhatsApp',
      sentTo: order.whatsapp,
      videoUrl: finalVideoUrl
    });

  } catch (error) {
    console.error('Error sending video WhatsApp:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}