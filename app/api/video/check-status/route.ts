import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Check Video Generation Status
 * 
 * Uses KIE.ai endpoint: GET /api/v1/mp4/record-info?taskId=xxx
 * 
 * Status values:
 * - PENDING: Task is waiting to be processed
 * - SUCCESS: Video generation completed successfully
 * - CREATE_TASK_FAILED: Failed to create the video generation task
 * - GENERATE_MP4_FAILED: Failed during video file creation
 */
export async function POST(request: NextRequest) {
  try {
    const { orderId, taskId } = await request.json();

    if (!orderId && !taskId) {
      return NextResponse.json(
        { error: 'orderId or taskId is required' },
        { status: 400 }
      );
    }

    let order = null;
    let videoTaskId = taskId;

    // If orderId provided, get the order and its video taskId
    if (orderId) {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError || !orderData) {
        return NextResponse.json(
          { error: 'Order not found' },
          { status: 404 }
        );
      }

      order = orderData;
      // Use video_task_id if available, otherwise fall back to suno_task_id
      videoTaskId = orderData.video_task_id || orderData.suno_task_id;
    }

    if (!videoTaskId) {
      return NextResponse.json(
        { error: 'No taskId available for this order' },
        { status: 400 }
      );
    }

    console.log('Checking video status for taskId:', videoTaskId);

    // Call KIE.ai API to get video status
    const statusResponse = await fetch(
      `https://api.kie.ai/api/v1/mp4/record-info?taskId=${videoTaskId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.SUNO_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const statusData = await statusResponse.json();

    console.log('KIE.ai status response:', JSON.stringify(statusData, null, 2));

    // KIE.ai returns code: 0 for generation endpoint, but code: 200 for status endpoint
    // Accept both as success
    if (statusData.code !== 0 && statusData.code !== 200) {
      return NextResponse.json({
        success: false,
        error: statusData.msg || 'Failed to get video status',
        code: statusData.code
      });
    }

    const videoInfo = statusData.data;
    // Handle both uppercase SUCCESS and lowercase success
    const status = videoInfo?.successFlag?.toUpperCase() || videoInfo?.successFlag;
    // Try multiple paths for videoUrl
    const videoUrl = videoInfo?.response?.videoUrl || videoInfo?.videoUrl || statusData.data?.video_url;

    // If video is ready and we have an order, update the database
    if (status === 'SUCCESS' && videoUrl && order && !order.video_url) {
      console.log('Video found! Updating order:', order.id);
      
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          video_url: videoUrl,
          status: 'video_ready',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (updateError) {
        console.error('Error updating order:', updateError);
      }
    }

    return NextResponse.json({
      success: true,
      taskId: videoTaskId,
      status: status,
      videoUrl: videoUrl,
      videoInfo: {
        taskId: videoInfo?.taskId,
        musicId: videoInfo?.musicId,
        successFlag: videoInfo?.successFlag,
        createTime: videoInfo?.createTime,
        completeTime: videoInfo?.completeTime,
        errorCode: videoInfo?.errorCode,
        errorMessage: videoInfo?.errorMessage
      },
      // Include raw response for debugging
      rawResponse: statusData
    });

  } catch (error) {
    console.error('Error checking video status:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}