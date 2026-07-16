import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Get order details from Supabase
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

    // Check if we have the required data for video generation
    if (!order.suno_task_id || !order.suno_audio_id) {
      return NextResponse.json(
        { error: 'Order does not have required Suno data for video generation' },
        { status: 400 }
      );
    }

    // Check if video is already being generated or completed
    if (order.video_url) {
      return NextResponse.json(
        { message: 'Video already generated', videoUrl: order.video_url },
        { status: 200 }
      );
    }

    // Prepare callback URL - use NEXT_PUBLIC_BASE_URL for production
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
    const callbackUrl = `${baseUrl}/api/video/webhook`;

    console.log('Calling KIE.ai API to generate video:', {
      taskId: order.suno_task_id,
      audioId: order.suno_audio_id,
      callBackUrl: callbackUrl,
      author: order.customer_name || 'Escribe Tu Canción'
    });

    // Call KIE.ai API to generate video
    const videoGenerationResponse = await fetch('https://api.kie.ai/api/v1/mp4/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUNO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskId: order.suno_task_id,
        audioId: order.suno_audio_id,
        callBackUrl: callbackUrl,
        author: order.customer_name || 'Escribe Tu Canción',
        domainName: 'escribetucancion.com'
      }),
    });

    const videoData = await videoGenerationResponse.json();

    console.log('KIE.ai API Response:', {
      status: videoGenerationResponse.status,
      response: videoData
    });

    // KIE.ai returns code: 0 or code: 200 for success depending on endpoint
    // Accept both as success
    const isSuccess = videoGenerationResponse.ok && (videoData.code === 0 || videoData.code === 200);
    
    if (!isSuccess) {
      console.error('KIE.ai API Error:', {
        status: videoGenerationResponse.status,
        response: videoData
      });
      
      return NextResponse.json(
        { 
          error: 'Failed to generate video', 
          details: videoData.msg || 'API request failed',
          code: videoData.code
        },
        { status: 500 }
      );
    }

    // Log success
    console.log('Video generation started successfully:', {
      orderId: order.id,
      videoTaskId: videoData.data?.taskId,
      customerName: order.customer_name
    });

    // Update order status and save video_task_id
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        video_task_id: videoData.data?.taskId,
        status: 'generating_video',
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('Error updating order status:', updateError);
    }

    return NextResponse.json({
      success: true,
      message: 'Video generation started',
      taskId: videoData.data?.taskId
    });

  } catch (error) {
    console.error('Error generating video:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}