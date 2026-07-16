// TikTok Ads Types and Interfaces
// Requirements: 2.1, 3.2, 3.3

export interface TikTokCredentials {
  appId: string
  appSecret: string
  accessToken: string
  advertiserId: string
}

export interface TikTokMetrics {
  spend: number
  impressions: number
  clicks: number
  ctr: number           // clicks / impressions * 100
  cpc: number           // spend / clicks
  cpm: number           // spend / impressions * 1000
  conversions: number
  cpa: number           // spend / conversions
}

export type CampaignStatus = 'CAMPAIGN_STATUS_ENABLE' | 'CAMPAIGN_STATUS_DISABLE' | 'CAMPAIGN_STATUS_DELETE' | 'ACTIVE' | 'PAUSED' | 'DELETED'

export interface TikTokCampaign {
  campaignId: string
  campaignName: string
  status: CampaignStatus
  spend: number
  impressions: number
  clicks: number
  ctr: number
  conversions: number
}

export interface CostBreakdown {
  paymentFees: number
  productionCosts: number
  videoCosts: number
  spotifyCosts: number
  fixedMonthlyCosts: number
  adTaxes: number
  otherCosts: number
  nonAdCosts: number
  totalCosts: number
}

export interface CostConfig {
  paymentFeePercent: number
  paymentFixedFee: number
  productionCostPerOrder: number
  videoCostPerOrder: number
  spotifyCostPerOrder: number
  fixedMonthlyCost: number
  adTaxPercent: number
  otherCostPerOrder: number
}

export interface DailySpendPoint {
  date: string
  spend: number
  revenue: number  // From orders data
}

export interface TikTokAdsData {
  metrics: TikTokMetrics
  previousMetrics: TikTokMetrics | null
  dailySpend: DailySpendPoint[]
  campaigns: TikTokCampaign[]
}

export interface ROIData {
  revenue: number        // From orders (paid)
  adSpend: number        // From TikTok
  profit: number         // revenue - adSpend (gross marketing profit)
  grossProfit: number    // Same as profit, kept explicit for profitability views
  netProfit: number      // revenue - adSpend - non-ad costs
  costs: CostBreakdown
  costConfig: CostConfig
  paidOrders: number
  averageOrderValue: number
  costPerOrder: number
  netMargin: number
  roi: number            // (gross profit / adSpend) * 100
  netRoi: number         // (net profit / adSpend) * 100
  roas: number           // revenue / adSpend
  breakEvenRoas: number | null  // ROAS needed to cover non-ad costs + ad spend; null when no ad spend can break even
  maxProfitableCpa: number
  previousRoi: number | null
  roiChange: number | null
  previousNetRoi: number | null
  netRoiChange: number | null
  attributionModel: 'account_total' | 'campaign_estimated'
  costWarnings: string[]
}

export type CampaignDecisionStatus = 'scale' | 'maintain' | 'review' | 'pause'

export interface CampaignDecision extends TikTokCampaign {
  estimatedRevenue: number
  estimatedNonAdCosts: number
  estimatedNetProfit: number
  estimatedRoas: number
  estimatedNetRoi: number
  cpa: number
  breakEvenRoas: number | null
  maxProfitableCpa: number
  decision: CampaignDecisionStatus
  decisionLabel: string
  decisionReason: string
}

export type TikTokAlertSeverity = 'success' | 'info' | 'warning' | 'critical'

export interface TikTokDecisionAlert {
  id: string
  severity: TikTokAlertSeverity
  title: string
  message: string
  action: string
}

export interface TikTokApiResponse<T> {
  code: number
  message: string
  data: T
  request_id: string
}

export interface TikTokReportData {
  dimensions: {
    stat_time_day?: string
    campaign_id?: string
  }
  metrics: {
    spend: string
    impressions: string
    clicks: string
    conversion: string
    ctr: string
    cpc: string
    cpm: string
    cost_per_conversion: string
  }
}

export interface TikTokCampaignData {
  campaign_id: string
  campaign_name: string
  status: CampaignStatus
  budget: number
  budget_mode: string
}

// Cache types
export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number  // milliseconds
}

export const CACHE_TTL = 5 * 60 * 1000 // 5 minutes in milliseconds
