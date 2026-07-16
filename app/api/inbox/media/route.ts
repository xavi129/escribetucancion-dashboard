import { NextResponse } from 'next/server'
import { getMediaUrl, downloadMedia } from '@/lib/whatsapp-business'

/**
 * GET /api/inbox/media?mediaId=xxx
 * 
 * Download media from WhatsApp API.
 * Proxies the request to handle authentication.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const mediaId = url.searchParams.get('mediaId')
    const download = url.searchParams.get('download') === 'true'

    if (!mediaId) {
      return NextResponse.json(
        { success: false, error: 'mediaId is required' },
        { status: 400 }
      )
    }

    if (download) {
      // Download and return the actual media file
      const buffer = await downloadMedia(mediaId)
      
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        },
      })
    }

    // Just return the URL (for preview purposes)
    const mediaUrl = await getMediaUrl(mediaId)
    
    return NextResponse.json({
      success: true,
      url: mediaUrl,
    })
  } catch (error) {
    console.error('[Media API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al descargar media' },
      { status: 500 }
    )
  }
}
