// TikTok Ads API Service
// Requirements: 3.2, 3.3, 6.2

import {
  TikTokMetrics,
  TikTokCampaign,
  DailySpendPoint,
  TikTokApiResponse,
  TikTokReportData,
  TikTokCampaignData,
  CACHE_TTL,
} from './tiktok-types'
import { calculateMetrics, sortCampaignsBySpend } from './tiktok-utils'
import { getFromCache, setInCache, CACHE_KEYS } from './tiktok-cache'
import { getDateRange, getPreviousDateRange } from './statistics-utils'
import { TimePeriod } from './statistics-types'
import { getValidAccessToken, getAdvertiserId } from './tiktok-auth'

const TIKTOK_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3'

/**
 * Check if TikTok credentials are configured
 */
export function hasCredentials(): boolean {
  return !!(
    process.env.TIKTOK_ACCESS_TOKEN &&
    process.env.TIKTOK_ADVERTISER_ID
  )
}

/**
 * Get TikTok API headers with valid token
 */
async function getHeaders(): Promise<Record<string, string>> {
  const token = await getValidAccessToken()
  return {
    'Access-Token': token || process.env.TIKTOK_ACCESS_TOKEN || '',
    'Content-Type': 'application/json',
  }
}

/**
 * Get advertiser ID (from token storage or env)
 */
async function getAdvertiserIdValue(): Promise<string> {
  const id = await getAdvertiserId()
  return id || process.env.TIKTOK_ADVERTISER_ID || ''
}

/**
 * Format date for TikTok API (YYYY-MM-DD)
 */
function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0]
}

function clampEndDateToToday(startDate: Date, endDate: Date): { start: Date; end: Date } {
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  if (endDate <= today) {
    return { start: startDate, end: endDate }
  }

  return { start: startDate, end: today }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 15000
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Fetch metrics from TikTok Reporting API
 */
async function fetchMetricsFromApi(startDate: Date, endDate: Date): Promise<TikTokMetrics> {
  if (!hasCredentials()) {
    throw new Error('TikTok credentials not configured')
  }

  const advertiserId = await getAdvertiserIdValue()
  const headers = await getHeaders()

  const params = new URLSearchParams({
    advertiser_id: advertiserId,
    report_type: 'BASIC',
    dimensions: JSON.stringify(['stat_time_day']),
    data_level: 'AUCTION_ADVERTISER',
    start_date: formatDateForApi(startDate),
    end_date: formatDateForApi(endDate),
    metrics: JSON.stringify([
      'spend',
      'impressions',
      'clicks',
      'conversion',
      'ctr',
      'cpc',
      'cpm',
      'cost_per_conversion',
    ]),
  })

  const response = await fetch(`${TIKTOK_API_BASE}/report/integrated/get/?${params.toString()}`, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    const errorText = await response.text()
    // Only log error details in development or when debug is enabled
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_TIKTOK === 'true') {
      console.error('[TikTok API] Error response:', errorText)
    } else {
      console.error('[TikTok API] Request failed:', response.status, response.statusText)
    }
    throw new Error(`TikTok API error: ${response.status} ${response.statusText}`)
  }

  const data: TikTokApiResponse<{ list: TikTokReportData[] }> = await response.json()

  // Debug logging (only in development or when DEBUG_TIKTOK is enabled)
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_TIKTOK === 'true') {
    console.debug('[TikTok API] Response received:', {
      code: data.code,
      message: data.message,
      dataCount: data.data?.list?.length || 0,
      dateRange: `${formatDateForApi(startDate)} to ${formatDateForApi(endDate)}`
    })
  }

  if (data.code !== 0) {
    throw new Error(`TikTok API error: ${data.message}`)
  }

  let totalSpend = 0
  let totalImpressions = 0
  let totalClicks = 0
  let totalConversions = 0

  for (const item of data.data?.list || []) {
    totalSpend += parseFloat(item.metrics.spend || '0')
    totalImpressions += parseInt(item.metrics.impressions || '0', 10)
    totalClicks += parseInt(item.metrics.clicks || '0', 10)
    totalConversions += parseInt(item.metrics.conversion || '0', 10)
  }

  return calculateMetrics(totalSpend, totalImpressions, totalClicks, totalConversions)
}

/**
 * Get metrics for a period (with caching)
 */
export async function getMetrics(period: TimePeriod): Promise<{
  metrics: TikTokMetrics
  previousMetrics: TikTokMetrics | null
}> {
  const cacheKey = CACHE_KEYS.metrics(period)
  const cached = getFromCache<{ metrics: TikTokMetrics; previousMetrics: TikTokMetrics | null }>(cacheKey)

  if (cached) {
    return cached
  }

  const currentRange = getDateRange(period)
  const previousRange = getPreviousDateRange(period)
  const currentTikTokRange = clampEndDateToToday(currentRange.start, currentRange.end)

  const [metrics, previousMetrics] = await Promise.all([
    fetchMetricsFromApi(currentTikTokRange.start, currentTikTokRange.end),
    fetchMetricsFromApi(previousRange.start, previousRange.end).catch(() => null),
  ])

  const result = { metrics, previousMetrics }
  setInCache(cacheKey, result, CACHE_TTL)

  return result
}

/**
 * Fetch campaigns from TikTok API
 */
async function fetchCampaignsFromApi(startDate: Date, endDate: Date): Promise<TikTokCampaign[]> {
  if (!hasCredentials()) {
    throw new Error('TikTok credentials not configured')
  }

  const advertiserId = await getAdvertiserIdValue()
  const headers = await getHeaders()

  const fetchCampaignReport = async (campaignIds?: string[]): Promise<TikTokReportData[]> => {
    const reportParams = new URLSearchParams({
      advertiser_id: advertiserId,
      report_type: 'BASIC',
      dimensions: JSON.stringify(['campaign_id']),
      data_level: 'AUCTION_CAMPAIGN',
      start_date: formatDateForApi(startDate),
      end_date: formatDateForApi(endDate),
      metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'conversion', 'ctr']),
      page: '1',
      page_size: '1000',
    })

    if (campaignIds && campaignIds.length > 0) {
      reportParams.set('filters', JSON.stringify([{
        field_name: 'campaign_id',
        filter_type: 'IN',
        filter_value: JSON.stringify(campaignIds),
      }]))
    }

    const reportResponse = await fetchWithTimeout(`${TIKTOK_API_BASE}/report/integrated/get/?${reportParams.toString()}`, {
      method: 'GET',
      headers,
    })

    if (!reportResponse.ok) {
      throw new Error(`TikTok API error: ${reportResponse.status}`)
    }

    const reportData: TikTokApiResponse<{ list: TikTokReportData[] }> = await reportResponse.json()

    if (reportData.code !== 0) {
      throw new Error(`TikTok API error: ${reportData.message}`)
    }

    return reportData.data?.list || []
  }

  const mapReportToCampaigns = (
    reportRows: TikTokReportData[],
    campaignMap: Map<string, TikTokCampaignData> = new Map()
  ): TikTokCampaign[] => {
    const campaigns: TikTokCampaign[] = reportRows.map(item => {
      const campaignId = item.dimensions.campaign_id || ''
      const campaignInfo = campaignMap.get(campaignId)
      return {
        campaignId,
        campaignName: campaignInfo?.campaign_name || `Campana ${campaignId || 'sin ID'}`,
        status: campaignInfo?.status || 'ACTIVE',
        spend: parseFloat(item.metrics.spend || '0'),
        impressions: parseInt(item.metrics.impressions || '0', 10),
        clicks: parseInt(item.metrics.clicks || '0', 10),
        ctr: parseFloat(item.metrics.ctr || '0'),
        conversions: parseInt(item.metrics.conversion || '0', 10),
      }
    })

    return sortCampaignsBySpend(campaigns)
  }

  const campaignResponse = await fetchWithTimeout(
    `${TIKTOK_API_BASE}/campaign/get/?advertiser_id=${advertiserId}&page_size=100`,
    { method: 'GET', headers }
  )

  if (!campaignResponse.ok) {
    const reportRows = await fetchCampaignReport()
    return mapReportToCampaigns(reportRows)
  }

  const campaignData: TikTokApiResponse<{ list: TikTokCampaignData[] }> = await campaignResponse.json()

  if (campaignData.code !== 0) {
    const isPermissionError = campaignData.message?.toLowerCase().includes('permission')
    if (isPermissionError) {
      const reportRows = await fetchCampaignReport()
      return mapReportToCampaigns(reportRows)
    }

    throw new Error(`TikTok API error: ${campaignData.message}`)
  }

  const campaignIds = (campaignData.data?.list || []).map(c => c.campaign_id)

  if (campaignIds.length === 0) {
    return []
  }

  const campaignMap = new Map(
    (campaignData.data?.list || []).map(c => [c.campaign_id, c])
  )

  const reportRows = await fetchCampaignReport(campaignIds)
  return mapReportToCampaigns(reportRows, campaignMap)
}

/**
 * Get campaigns for a period (with caching)
 */
export async function getCampaigns(period: TimePeriod): Promise<TikTokCampaign[]> {
  const cacheKey = CACHE_KEYS.campaigns(period)
  const cached = getFromCache<TikTokCampaign[]>(cacheKey)

  if (cached) {
    return cached
  }

  const range = getDateRange(period)
  const tiktokRange = clampEndDateToToday(range.start, range.end)
  const campaigns = await fetchCampaignsFromApi(tiktokRange.start, tiktokRange.end)

  setInCache(cacheKey, campaigns, CACHE_TTL)

  return campaigns
}

/**
 * Fetch daily spend data from TikTok API
 */
async function fetchDailySpendFromApi(startDate: Date, endDate: Date): Promise<DailySpendPoint[]> {
  if (!hasCredentials()) {
    throw new Error('TikTok credentials not configured')
  }

  const advertiserId = await getAdvertiserIdValue()
  const headers = await getHeaders()

  const params = new URLSearchParams({
    advertiser_id: advertiserId,
    report_type: 'BASIC',
    dimensions: JSON.stringify(['stat_time_day']),
    data_level: 'AUCTION_ADVERTISER',
    start_date: formatDateForApi(startDate),
    end_date: formatDateForApi(endDate),
    metrics: JSON.stringify(['spend']),
  })

  const response = await fetch(`${TIKTOK_API_BASE}/report/integrated/get/?${params.toString()}`, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    throw new Error(`TikTok API error: ${response.status}`)
  }

  const data: TikTokApiResponse<{ list: TikTokReportData[] }> = await response.json()

  if (data.code !== 0) {
    throw new Error(`TikTok API error: ${data.message}`)
  }

  return (data.data?.list || []).map(item => ({
    date: item.dimensions.stat_time_day || '',
    spend: parseFloat(item.metrics.spend || '0'),
    revenue: 0,
  }))
}

/**
 * Get daily spend for a period (with caching)
 */
export async function getDailySpend(period: TimePeriod): Promise<DailySpendPoint[]> {
  const cacheKey = CACHE_KEYS.dailySpend(period)
  const cached = getFromCache<DailySpendPoint[]>(cacheKey)

  if (cached) {
    return cached
  }

  const range = getDateRange(period)
  const tiktokRange = clampEndDateToToday(range.start, range.end)
  const dailySpend = await fetchDailySpendFromApi(tiktokRange.start, tiktokRange.end)

  setInCache(cacheKey, dailySpend, CACHE_TTL)

  return dailySpend
}

/**
 * Validate TikTok credentials by making a test API call
 */
export async function validateCredentials(): Promise<{ valid: boolean; error?: string }> {
  if (!hasCredentials()) {
    return { valid: false, error: 'Credentials not configured' }
  }

  try {
    const advertiserId = await getAdvertiserIdValue()
    const headers = await getHeaders()
    
    const response = await fetch(
      `${TIKTOK_API_BASE}/advertiser/info/?advertiser_ids=["${advertiserId}"]`,
      { method: 'GET', headers }
    )

    if (!response.ok) {
      return { valid: false, error: `HTTP ${response.status}` }
    }

    const data: TikTokApiResponse<unknown> = await response.json()

    if (data.code !== 0) {
      return { valid: false, error: data.message }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
