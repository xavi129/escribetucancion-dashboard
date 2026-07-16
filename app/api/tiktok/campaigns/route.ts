import { NextRequest, NextResponse } from 'next/server'
import { getCampaigns, hasCredentials } from '@/lib/tiktok-service'
import { TimePeriod } from '@/lib/statistics-types'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const period = (searchParams.get('period') || 'weekly') as TimePeriod

    if (!hasCredentials()) {
      return NextResponse.json({
        success: false,
        error: 'TikTok credentials not configured',
        configured: false,
      })
    }

    const campaigns = await getCampaigns(period)

    return NextResponse.json({
      success: true,
      data: { campaigns },
    })
  } catch (error) {
    console.error('Error fetching TikTok campaigns:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
