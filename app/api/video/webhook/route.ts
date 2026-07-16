import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Video Generation Callback Webhook
 * 
 * According to KIE.ai docs, the callback format is:
 * Success: { code: 200, msg: "success", data: { task_id: "...", video_url: "..." } }
 * Failure: { code: 500, msg: "Internal Error...", data: { task_id: "...", video_url: null } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Received video generation callback:', JSON.stringify(body, null, 2));

    const { code, msg, data } = body;

    // Get task_id from callback data
    const taskId = data?.task_id;
    const videoUrl = data?.video_url;
    
    if (!taskId) {
      console.error('Missing task_id in callback data:', body);
      // Return 200 to acknowledge receipt (prevent retries)
      return NextResponse.json({ status: 'received' }, { status: 200 });
    }

    console.log('Processing callback:', { taskId, code, msg, hasVideoUrl: !!videoUrl });

    // Find the order by video_task_id first, then fall back to suno_task_id
    let order = null;
    let orderError = null;

    // Try video_task_id first (this is the task ID returned when generating video)
    const { data: orderByVideoTask, error: videoTaskError } = await supabase
      .from('orders')
      .select('*')
      .eq('video_task_id', taskId)
      .single();

    if (orderByVideoTask) {
      order = orderByVideoTask;
    } else {
      // Fall back to suno_task_id (for backwards compatibility)
      const { data: orderBySunoTask, error: sunoTaskError } = await supabase
        .from('orders')
        .select('*')
        .eq('suno_task_id', taskId)
        .single();
      
      order = orderBySunoTask;
      orderError = sunoTaskError;
    }

    if (!order) {
      console.error('Order not found for task_id:', taskId, 'Error:', orderError || videoTaskError);
      // Return 200 to acknowledge receipt (prevent retries)
      return NextResponse.json({ status: 'received' }, { status: 200 });
    }

    console.log('Found order:', order.id, 'for customer:', order.customer_name);

    // According to docs: code 200 = success, code 500 = error
    if (code === 200 && videoUrl) {
      console.log('Video generation successful:', {
        orderId: order.id,
        videoUrl: videoUrl,
        customerName: order.customer_name
      });

      // Update order with video URL and mark as completed
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          video_url: videoUrl,
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (updateError) {
        console.error('Error updating order with video URL:', updateError);
      } else {
        // Send notification to customer via WhatsApp
        await sendVideoNotificationToCustomer(order, videoUrl);
        console.log(`Video generation completed for order ${order.id}`);
      }
      
    } else {
      // Video generation failed (code 500 or no video_url)
      console.error(`Video generation failed for task ${taskId}:`, { code, msg });
      
      // Update order status to indicate failure
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'video_failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (updateError) {
        console.error('Error updating order status to failed:', updateError);
      }
    }

    // Always return 200 to confirm callback received (as per docs)
    return NextResponse.json({ status: 'received' });

  } catch (error) {
    console.error('Error processing video webhook:', error);
    // Still return 200 to prevent infinite retries
    return NextResponse.json({ status: 'received' }, { status: 200 });
  }
}

async function sendVideoNotificationToCustomer(order: any, videoUrl: string) {
  try {
    if (!order.whatsapp) {
      console.log('No WhatsApp number for order:', order.id);
      return;
    }

    const whatsappMessage = `🎬 ¡Tu video musical está listo! 🎵

Hola ${order.customer_name}, 

Tu canción "${order.spotify_song_name || 'Tu Canción Personalizada'}" ahora tiene su propio video musical.

🔗 Ver tu video: ${videoUrl}

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

    if (response.ok) {
      console.log('WhatsApp notification sent successfully for order:', order.id);
    } else {
      console.error('Failed to send WhatsApp notification:', await response.text());
    }
  } catch (error) {
    console.error('Error sending video notification to customer:', error);
  }
}

// GET endpoint for webhook verification
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'active',
    message: 'Video webhook endpoint is working',
    timestamp: new Date().toISOString()
  });
}