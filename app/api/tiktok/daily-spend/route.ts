import { NextRequest, NextResponse } from 'next/server'
import { getDailySpend, hasCredentials } from '@/lib/tiktok-service'
import { TimePeriod } from '@/lib/statistics-types'
import { supabase } from '@/lib/supabase'
import { getDateRange } from '@/lib/statistics-utils'
import { convertCurrencyToMXN } from '@/lib/currency-utils'

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

    // Get daily spend from TikTok
    const dailySpend = await getDailySpend(period)

    // Get daily revenue from orders
    const range = getDateRange(period)
    const { data: orders } = await supabase
      .from('orders')
      .select('created_at, total_price, currency, payment_status')
      .eq('payment_status', 'paid')
      .gte('created_at', range.start.toISOString())
      .lte('created_at', range.end.toISOString())

    // Group orders by date
    const revenueByDate = new Map<string, number>()
    for (const order of orders || []) {
      const date = order.created_at.split('T')[0]
      const current = revenueByDate.get(date) || 0
      revenueByDate.set(date, current + convertCurrencyToMXN(order.total_price, order.currency))
    }

    // Merge revenue into daily spend data
    const mergedData = dailySpend.map(item => ({
      ...item,
      revenue: revenueByDate.get(item.date) || 0,
    }))

    return NextResponse.json({
      success: true,
      data: { dailySpend: mergedData },
    })
  } catch (error) {
    console.error('Error fetching TikTok daily spend:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
