import { supabase, supabaseAdmin } from './supabase'
import { convertCurrencyToMXN } from './currency-utils'
import { TimePeriod } from './statistics-types'
import { getDateRange, getPreviousDateRange, toISOString } from './statistics-utils'
import { CostConfig, ROIData } from './tiktok-types'
import {
  DEFAULT_COST_CONFIG,
  calculateCostBreakdown,
  calculateROIData,
} from './tiktok-utils'

type ProfitabilityOrder = {
  total_price: number | null
  currency: string | null
  video: boolean | null
  spotify_upload: boolean | null
}

type OrderSummary = {
  revenue: number
  paidOrders: number
  videoOrders: number
  spotifyOrders: number
}

function parseMoneyEnv(name: string, fallback: number = 0): number {
  const raw = process.env[name]
  if (!raw) return fallback

  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function parsePercentEnv(name: string, fallback: number = 0): number {
  const raw = process.env[name]
  if (!raw) return fallback

  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) return fallback

  return value
}

export function getTikTokCostConfig(): CostConfig {
  return {
    ...DEFAULT_COST_CONFIG,
    paymentFeePercent: parsePercentEnv('TIKTOK_PAYMENT_FEE_PERCENT'),
    paymentFixedFee: parseMoneyEnv('TIKTOK_PAYMENT_FIXED_FEE_MXN'),
    productionCostPerOrder: parseMoneyEnv('TIKTOK_PRODUCTION_COST_PER_ORDER_MXN'),
    videoCostPerOrder: parseMoneyEnv('TIKTOK_VIDEO_COST_PER_ORDER_MXN'),
    spotifyCostPerOrder: parseMoneyEnv('TIKTOK_SPOTIFY_COST_PER_ORDER_MXN'),
    fixedMonthlyCost: parseMoneyEnv('TIKTOK_FIXED_MONTHLY_COST_MXN'),
    adTaxPercent: parsePercentEnv('TIKTOK_AD_TAX_PERCENT'),
    otherCostPerOrder: parseMoneyEnv('TIKTOK_OTHER_COST_PER_ORDER_MXN'),
  }
}

function getFixedMonthlyCostForRange(startDate: Date, endDate: Date, monthlyCost: number): number {
  if (monthlyCost <= 0) return 0

  const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate()
  const millisecondsPerDay = 24 * 60 * 60 * 1000
  const daysInRange = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / millisecondsPerDay))

  return (monthlyCost / daysInMonth) * Math.min(daysInRange, daysInMonth)
}

async function fetchPaidOrders(startDate: Date, endDate: Date): Promise<ProfitabilityOrder[]> {
  const client = supabaseAdmin || supabase
  const { data, error } = await client
    .from('orders')
    .select('total_price, currency, video, spotify_upload')
    .eq('payment_status', 'paid')
    .gte('created_at', toISOString(startDate))
    .lte('created_at', toISOString(endDate))

  if (error) {
    console.error('Error fetching paid orders for TikTok profitability:', error)
    throw new Error(`Failed to fetch paid orders: ${error.message}`)
  }

  return (data || []) as ProfitabilityOrder[]
}

function summarizeOrders(orders: ProfitabilityOrder[]): OrderSummary {
  return {
    revenue: orders.reduce((sum, order) => sum + convertCurrencyToMXN(order.total_price, order.currency), 0),
    paidOrders: orders.length,
    videoOrders: orders.filter((order) => order.video).length,
    spotifyOrders: orders.filter((order) => order.spotify_upload).length,
  }
}

export async function getTikTokProfitability(
  period: TimePeriod,
  adSpend: number,
  previousAdSpend?: number
): Promise<ROIData> {
  const currentRange = getDateRange(period)
  const previousRange = getPreviousDateRange(period)
  const costConfig = getTikTokCostConfig()

  const [currentOrders, previousOrders] = await Promise.all([
    fetchPaidOrders(currentRange.start, currentRange.end),
    previousAdSpend !== undefined
      ? fetchPaidOrders(previousRange.start, previousRange.end)
      : Promise.resolve([]),
  ])

  const current = summarizeOrders(currentOrders)
  const previous = summarizeOrders(previousOrders)
  const currentCosts = calculateCostBreakdown(
    current.revenue,
    adSpend,
    current.paidOrders,
    current.videoOrders,
    current.spotifyOrders,
    costConfig,
    getFixedMonthlyCostForRange(currentRange.start, currentRange.end, costConfig.fixedMonthlyCost)
  )
  const previousCosts = calculateCostBreakdown(
    previous.revenue,
    previousAdSpend || 0,
    previous.paidOrders,
    previous.videoOrders,
    previous.spotifyOrders,
    costConfig,
    getFixedMonthlyCostForRange(previousRange.start, previousRange.end, costConfig.fixedMonthlyCost)
  )

  return calculateROIData(
    current.revenue,
    adSpend,
    previousAdSpend !== undefined ? previous.revenue : undefined,
    previousAdSpend,
    current.paidOrders,
    currentCosts,
    costConfig,
    previousCosts.nonAdCosts
  )
}
