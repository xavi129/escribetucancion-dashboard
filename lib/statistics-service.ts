// Statistics Service
// Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.2, 4.3, 4.4, 5.1, 5.2, 7.1, 7.2, 7.3

import { supabase, type Order } from './supabase'
import { convertCurrencyToMXN } from './currency-utils'
import {
  TimePeriod,
  KPIData,
  RevenueDataPoint,
  StatusCount,
  StatusDistributionData,
  RankedItem,
  TopMetricsData,
  StatisticsData,
} from './statistics-types'
import {
  getDateRange,
  getPreviousDateRange,
  toISOString,
  getDateLabel,
  getTimeSlots,
  getTimeSlotKey,
} from './statistics-utils'

/**
 * Fetch orders within a date range from Supabase
 */
async function fetchOrdersInRange(startDate: Date, endDate: Date): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .gte('created_at', toISOString(startDate))
    .lte('created_at', toISOString(endDate))

  if (error) {
    console.error('Error fetching orders:', error)
    throw new Error(`Failed to fetch orders: ${error.message}`)
  }

  return data as Order[]
}

/**
 * Calculate KPIs from a set of orders
 */
export function calculateKPIs(orders: Order[]): KPIData {
  const paidOrders = orders.filter(o => o.payment_status === 'paid')
  const completedOrders = orders.filter(o => o.status === 'completed')
  const pendingOrders = orders.filter(o => o.payment_status === 'pending')
  const leadOrders = orders.filter(o => o.status === 'lead' || o.status === 'early_lead')

  const totalRevenue = paidOrders.reduce((sum, o) => sum + convertCurrencyToMXN(o.total_price, o.currency), 0)
  const averageOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0
  
  // Conversion rate: paid orders / (leads + paid orders) * 100
  const totalLeadsAndPaid = leadOrders.length + paidOrders.length
  const conversionRate = totalLeadsAndPaid > 0 ? (paidOrders.length / totalLeadsAndPaid) * 100 : 0

  return {
    totalRevenue,
    completedOrders: completedOrders.length,
    paidOrders: paidOrders.length,
    pendingOrders: pendingOrders.length,
    averageOrderValue,
    conversionRate,
  }
}

/**
 * Calculate revenue time series from orders
 */
export function calculateRevenueSeries(
  orders: Order[],
  period: TimePeriod,
  dateRange: { start: Date; end: Date }
): RevenueDataPoint[] {
  const paidOrders = orders.filter(o => o.payment_status === 'paid')
  const slots = getTimeSlots(period, dateRange)
  
  // Group orders by time slot
  const groupedData = new Map<string, { revenue: number; count: number }>()
  
  // Initialize all slots with zero
  slots.forEach(slot => {
    const key = getTimeSlotKey(slot, period)
    groupedData.set(key, { revenue: 0, count: 0 })
  })
  
  // Aggregate paid orders into slots
  paidOrders.forEach(order => {
    const orderDate = new Date(order.created_at)
    const key = getTimeSlotKey(orderDate, period)
    const existing = groupedData.get(key)
    if (existing) {
      existing.revenue += convertCurrencyToMXN(order.total_price, order.currency)
      existing.count += 1
    }
  })
  
  // Convert to array with labels
  return slots.map(slot => {
    const key = getTimeSlotKey(slot, period)
    const data = groupedData.get(key) || { revenue: 0, count: 0 }
    return {
      label: getDateLabel(slot, period),
      revenue: data.revenue,
      orderCount: data.count,
    }
  })
}

/**
 * Calculate status distribution from orders
 */
export function calculateStatusDistribution(orders: Order[]): StatusDistributionData {
  const total = orders.length
  
  // Order status distribution
  const orderStatusCounts = new Map<string, number>()
  orders.forEach(order => {
    const status = order.status || 'unknown'
    orderStatusCounts.set(status, (orderStatusCounts.get(status) || 0) + 1)
  })
  
  const orderStatus: StatusCount[] = Array.from(orderStatusCounts.entries())
    .map(([status, count]) => ({
      status,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
  
  // Payment status distribution
  const paymentStatusCounts = new Map<string, number>()
  orders.forEach(order => {
    const status = order.payment_status || 'unknown'
    paymentStatusCounts.set(status, (paymentStatusCounts.get(status) || 0) + 1)
  })
  
  const paymentStatus: StatusCount[] = Array.from(paymentStatusCounts.entries())
    .map(([status, count]) => ({
      status,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
  
  return { orderStatus, paymentStatus }
}

/**
 * Calculate top metrics from orders
 */
export function calculateTopMetrics(orders: Order[]): TopMetricsData {
  const total = orders.length
  
  // Top genres
  const genreCounts = new Map<string, number>()
  orders.forEach(order => {
    const genre = order.genre || 'Sin especificar'
    genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1)
  })
  
  const topGenres: RankedItem[] = Array.from(genreCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  
  // Top countries
  const countryCounts = new Map<string, number>()
  orders.forEach(order => {
    const country = order.country || 'Sin especificar'
    countryCounts.set(country, (countryCounts.get(country) || 0) + 1)
  })
  
  const topCountries: RankedItem[] = Array.from(countryCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  
  // Delivery types
  const deliveryCounts = new Map<string, number>()
  orders.forEach(order => {
    const deliveryType = order.delivery_type || 'Sin especificar'
    deliveryCounts.set(deliveryType, (deliveryCounts.get(deliveryType) || 0) + 1)
  })
  
  const deliveryTypes: RankedItem[] = Array.from(deliveryCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
  
  return { topGenres, topCountries, deliveryTypes }
}

/**
 * Get all statistics for a given period
 */
export async function getStatistics(
  period: TimePeriod,
  referenceDate: Date = new Date()
): Promise<StatisticsData> {
  const currentRange = getDateRange(period, referenceDate)
  const previousRange = getPreviousDateRange(period, referenceDate)
  
  // Fetch orders for both periods in parallel
  const [currentOrders, previousOrders] = await Promise.all([
    fetchOrdersInRange(currentRange.start, currentRange.end),
    fetchOrdersInRange(previousRange.start, previousRange.end),
  ])
  
  // Calculate all metrics
  const kpis = calculateKPIs(currentOrders)
  const previousKpis = calculateKPIs(previousOrders)
  const revenueSeries = calculateRevenueSeries(currentOrders, period, currentRange)
  const statusDistribution = calculateStatusDistribution(currentOrders)
  const topMetrics = calculateTopMetrics(currentOrders)
  
  return {
    kpis,
    previousKpis,
    revenueSeries,
    statusDistribution,
    topMetrics,
  }
}
