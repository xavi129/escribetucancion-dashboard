import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const TIKTOK_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3'

const endDate = process.argv[2] || new Date().toISOString().slice(0, 10)
const lookbackDays = Number(process.argv[3] || 90)
const startDate = addDays(endDate, -(lookbackDays - 1))

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function money(value) {
  return Number(value || 0)
}

function safeDiv(numerator, denominator) {
  return denominator ? numerator / denominator : 0
}

function cpa(spend, conversions) {
  if (conversions > 0) return spend / conversions
  return spend > 0 ? null : 0
}

function pctChange(current, previous) {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}

function weekStart(dateString) {
  const date = new Date(`${datePart(dateString)}T00:00:00.000Z`)
  const day = date.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  date.setUTCDate(date.getUTCDate() + diffToMonday)
  return date.toISOString().slice(0, 10)
}

function datePart(value) {
  return String(value || '').slice(0, 10)
}

function summarize(rows) {
  const spend = rows.reduce((sum, row) => sum + row.spend, 0)
  const conversions = rows.reduce((sum, row) => sum + row.conversions, 0)
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0)
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0)
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0)
  const paidOrders = rows.reduce((sum, row) => sum + row.paidOrders, 0)

  return {
    spend,
    conversions,
    conversionsPerPeso: safeDiv(conversions, spend),
    cpa: cpa(spend, conversions),
    clicks,
    impressions,
    ctr: safeDiv(clicks, impressions) * 100,
    cpc: safeDiv(spend, clicks),
    revenue,
    paidOrders,
    roas: safeDiv(revenue, spend),
  }
}

function groupBy(rows, keyFn) {
  const map = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row)
  }
  return [...map.entries()].map(([key, groupedRows]) => ({ key, ...summarize(groupedRows) }))
}

async function getTikTokRows(dimensions, metrics, extraParams = {}) {
  const params = new URLSearchParams({
    advertiser_id: process.env.TIKTOK_ADVERTISER_ID,
    report_type: 'BASIC',
    dimensions: JSON.stringify(dimensions),
    data_level: extraParams.dataLevel || 'AUCTION_ADVERTISER',
    start_date: extraParams.startDate || startDate,
    end_date: extraParams.endDate || endDate,
    metrics: JSON.stringify(metrics),
    page: '1',
    page_size: '1000',
  })

  if (extraParams.filters) {
    params.set('filters', JSON.stringify(extraParams.filters))
  }

  const response = await fetch(`${TIKTOK_API_BASE}/report/integrated/get/?${params.toString()}`, {
    headers: {
      'Access-Token': process.env.TIKTOK_ACCESS_TOKEN,
      'Content-Type': 'application/json',
    },
  })

  const body = await response.json()
  if (!response.ok || body.code !== 0) {
    throw new Error(`TikTok API error ${response.status}: ${body.message || response.statusText}`)
  }

  return body.data?.list || []
}

async function getTikTokRowsInChunks(dimensions, metrics, extraParams = {}) {
  const rows = []
  let chunkStart = startDate

  while (chunkStart <= endDate) {
    const chunkEnd = addDays(chunkStart, 29) < endDate ? addDays(chunkStart, 29) : endDate
    rows.push(...await getTikTokRows(dimensions, metrics, {
      ...extraParams,
      startDate: chunkStart,
      endDate: chunkEnd,
    }))
    chunkStart = addDays(chunkEnd, 1)
  }

  return rows
}

async function getRevenueByDate() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return new Map()

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await supabase
    .from('orders')
    .select('created_at,total_price,currency,payment_status')
    .eq('payment_status', 'paid')
    .gte('created_at', `${startDate}T00:00:00.000Z`)
    .lte('created_at', `${endDate}T23:59:59.999Z`)

  if (error) throw new Error(`Supabase error: ${error.message}`)

  const ratesToMxn = { MXN: 1, USD: 18, COP: 0.0045, CLP: 0.019, PEN: 4.8 }
  const map = new Map()
  for (const order of data || []) {
    const date = order.created_at.slice(0, 10)
    const currency = (order.currency || 'MXN').toUpperCase()
    const revenue = money(order.total_price) * (ratesToMxn[currency] || 1)
    const current = map.get(date) || { revenue: 0, paidOrders: 0 }
    current.revenue += revenue
    current.paidOrders += 1
    map.set(date, current)
  }

  return map
}

const dailyRaw = await getTikTokRowsInChunks(
  ['stat_time_day'],
  ['spend', 'impressions', 'clicks', 'conversion', 'ctr', 'cpc', 'cpm', 'cost_per_conversion']
)
const revenueByDate = await getRevenueByDate()

const metricsByDate = new Map(
  dailyRaw.map((item) => {
    const date = datePart(item.dimensions.stat_time_day)
    return [date, {
      date,
      spend: money(item.metrics.spend),
      impressions: Number(item.metrics.impressions || 0),
      clicks: Number(item.metrics.clicks || 0),
      conversions: Number(item.metrics.conversion || 0),
    }]
  })
)

const daily = []
for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
  const metrics = metricsByDate.get(date) || { date, spend: 0, impressions: 0, clicks: 0, conversions: 0 }
  const revenue = revenueByDate.get(date) || { revenue: 0, paidOrders: 0 }
  daily.push({
    ...metrics,
    revenue: revenue.revenue,
    paidOrders: revenue.paidOrders,
  })
}

const weekly = groupBy(daily, (row) => weekStart(row.date))
const last28 = summarize(daily.slice(-28))
const previous28 = summarize(daily.slice(-56, -28))
const beforePrevious28 = summarize(daily.slice(-84, -56))

const weeklyWithChange = weekly.map((week, index) => {
  const previous = weekly[index - 1]
  return {
    ...week,
    conversionsPerPesoChange: previous ? pctChange(week.conversionsPerPeso, previous.conversionsPerPeso) : null,
    cpaChange: previous ? pctChange(week.cpa, previous.cpa) : null,
  }
})

const dailyWorst = daily
  .filter((row) => row.spend > 0)
  .map((row) => ({ ...row, conversionsPerPeso: safeDiv(row.conversions, row.spend), cpa: cpa(row.spend, row.conversions), roas: safeDiv(row.revenue, row.spend) }))
  .sort((a, b) => a.conversionsPerPeso - b.conversionsPerPeso)
  .slice(0, 10)

let campaigns = []
try {
  const campaignRaw = await getTikTokRows(
    ['campaign_id'],
    ['spend', 'impressions', 'clicks', 'conversion', 'ctr'],
    { dataLevel: 'AUCTION_CAMPAIGN' }
  )
  campaigns = campaignRaw
    .map((item) => ({
      campaignId: item.dimensions.campaign_id,
      spend: money(item.metrics.spend),
      impressions: Number(item.metrics.impressions || 0),
      clicks: Number(item.metrics.clicks || 0),
      conversions: Number(item.metrics.conversion || 0),
    }))
    .filter((row) => row.spend > 0)
    .map((row) => ({ ...row, conversionsPerPeso: safeDiv(row.conversions, row.spend), cpa: cpa(row.spend, row.conversions) }))
    .sort((a, b) => b.spend - a.spend)
} catch (error) {
  campaigns = [{ error: error.message }]
}

const report = {
  range: { startDate, endDate, lookbackDays },
  totals: summarize(daily),
  comparisons: {
    last28,
    previous28,
    beforePrevious28,
    last28VsPrevious28: {
      spend: pctChange(last28.spend, previous28.spend),
      conversions: pctChange(last28.conversions, previous28.conversions),
      conversionsPerPeso: pctChange(last28.conversionsPerPeso, previous28.conversionsPerPeso),
      cpa: pctChange(last28.cpa, previous28.cpa),
      roas: pctChange(last28.roas, previous28.roas),
    },
    previous28VsBeforePrevious28: {
      spend: pctChange(previous28.spend, beforePrevious28.spend),
      conversions: pctChange(previous28.conversions, beforePrevious28.conversions),
      conversionsPerPeso: pctChange(previous28.conversionsPerPeso, beforePrevious28.conversionsPerPeso),
      cpa: pctChange(previous28.cpa, beforePrevious28.cpa),
      roas: pctChange(previous28.roas, beforePrevious28.roas),
    },
  },
  weekly: weeklyWithChange,
  dailyWorst,
  campaigns,
}

console.log(JSON.stringify(report, null, 2))
