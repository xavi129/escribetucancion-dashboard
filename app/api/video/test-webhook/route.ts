import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { taskId, videoUrl, orderId } = await request.json();

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      );
    }

    // Simulate KIE.ai callback format (according to official docs)
    const testCallback = {
      code: 200,
      msg: 'success',
      data: {
        task_id: taskId,
        video_url: videoUrl || 'https://example.com/test-video.mp4'
      }
    };

    console.log('Sending test callback:', testCallback);

    // Call the actual webhook
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/video/webhook`;
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testCallback),
    });

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Test callback sent',
      webhookResponse: result,
      webhookStatus: response.status
    });

  } catch (error) {
    console.error('Error sending test callback:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send test callback',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Video webhook test endpoint',
    usage: 'POST with { taskId, videoUrl?, orderId? }',
    example: {
      taskId: 'your_suno_task_id',
      videoUrl: 'https://example.com/video.mp4',
      orderId: 'optional_order_id'
    }
  });
}