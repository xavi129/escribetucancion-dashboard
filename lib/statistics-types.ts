// Statistics Types and Interfaces
// Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6

export type TimePeriod = 'daily' | 'weekly' | 'monthly'

export interface DateRange {
  start: Date
  end: Date
}

export interface KPIData {
  totalRevenue: number
  completedOrders: number
  paidOrders: number
  pendingOrders: number
  averageOrderValue: number
  conversionRate: number
}

export interface RevenueDataPoint {
  label: string      // Hour (e.g., "14:00"), day name (e.g., "Lunes"), or date (e.g., "15 Nov")
  revenue: number
  orderCount: number
}

export interface StatusCount {
  status: string
  count: number
  percentage: number
}

export interface StatusDistributionData {
  orderStatus: StatusCount[]
  paymentStatus: StatusCount[]
}

export interface RankedItem {
  name: string
  count: number
  percentage: number
}

export interface TopMetricsData {
  topGenres: RankedItem[]
  topCountries: RankedItem[]
  deliveryTypes: RankedItem[]
}

export interface StatisticsData {
  kpis: KPIData
  previousKpis: KPIData | null
  revenueSeries: RevenueDataPoint[]
  statusDistribution: StatusDistributionData
  topMetrics: TopMetricsData
}

export interface StatisticsState {
  period: TimePeriod
  loading: boolean
  error: string | null
  data: StatisticsData | null
}
