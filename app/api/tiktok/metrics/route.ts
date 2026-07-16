import { NextRequest, NextResponse } from 'next/server'
import { getMetrics, hasCredentials } from '@/lib/tiktok-service'
import { getTikTokProfitability } from '@/lib/tiktok-profitability-service'
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

    // Get TikTok metrics
    const { metrics, previousMetrics } = await getMetrics(period)

    // Calculate profitability from paid orders and configurable costs
    const roiData = await getTikTokProfitability(
      period,
      metrics.spend,
      previousMetrics?.spend
    )

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        previousMetrics,
        roi: roiData,
      },
    })
  } catch (error) {
    console.error('Error fetching TikTok metrics:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
