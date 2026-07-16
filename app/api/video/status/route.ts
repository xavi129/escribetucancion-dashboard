import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const taskId = searchParams.get('taskId');

    if (!orderId && !taskId) {
      return NextResponse.json(
        { error: 'Order ID or Task ID is required' },
        { status: 400 }
      );
    }

    let order;
    
    if (orderId) {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      
      if (error || !data) {
        return NextResponse.json(
          { error: 'Order not found' },
          { status: 404 }
        );
      }
      order = data;
    } else if (taskId) {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('suno_task_id', taskId)
        .single();
      
      if (error || !data) {
        return NextResponse.json(
          { error: 'Order not found for task ID' },
          { status: 404 }
        );
      }
      order = data;
    }

    // Check if we can generate video
    const canGenerateVideo = order.suno_task_id && order.suno_audio_id && !order.video_url;
    
    // Determine video status
    let videoStatus = 'not_started';
    if (order.video_url) {
      videoStatus = 'completed';
    } else if (order.status === 'generating_video') {
      videoStatus = 'generating';
    } else if (order.status === 'video_failed') {
      videoStatus = 'failed';
    }

    return NextResponse.json({
      orderId: order.id,
      videoStatus,
      videoUrl: order.video_url,
      canGenerateVideo,
      sunoTaskId: order.suno_task_id,
      sunoAudioId: order.suno_audio_id,
      customerName: order.customer_name,
      songName: order.spotify_song_name
    });

  } catch (error) {
    console.error('Error getting video status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}