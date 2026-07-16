// TikTok Ads Utility Functions
// Requirements: 2.2, 2.3, 3.2, 3.3

import {
  CampaignDecision,
  CostBreakdown,
  CostConfig,
  ROIData,
  TikTokCampaign,
  TikTokDecisionAlert,
  TikTokMetrics,
} from './tiktok-types'

export const DEFAULT_COST_CONFIG: CostConfig = {
  paymentFeePercent: 0,
  paymentFixedFee: 0,
  productionCostPerOrder: 0,
  videoCostPerOrder: 0,
  spotifyCostPerOrder: 0,
  fixedMonthlyCost: 0,
  adTaxPercent: 0,
  otherCostPerOrder: 0,
}

/**
 * Calculate ROI (Return on Investment)
 * Formula: ((revenue - adSpend) / adSpend) * 100
 * Returns null if adSpend is 0
 */
export function calculateROI(revenue: number, adSpend: number): number | null {
  if (adSpend === 0) return null
  return ((revenue - adSpend) / adSpend) * 100
}

/**
 * Calculate ROAS (Return on Ad Spend)
 * Formula: revenue / adSpend
 * Returns null if adSpend is 0
 */
export function calculateROAS(revenue: number, adSpend: number): number | null {
  if (adSpend === 0) return null
  return revenue / adSpend
}

/**
 * Calculate CTR (Click-Through Rate)
 * Formula: (clicks / impressions) * 100
 * Returns 0 if impressions is 0
 */
export function calculateCTR(clicks: number, impressions: number): number {
  if (impressions === 0) return 0
  return (clicks / impressions) * 100
}

/**
 * Calculate CPC (Cost Per Click)
 * Formula: spend / clicks
 * Returns 0 if clicks is 0
 */
export function calculateCPC(spend: number, clicks: number): number {
  if (clicks === 0) return 0
  return spend / clicks
}

/**
 * Calculate CPM (Cost Per Mille / 1000 impressions)
 * Formula: (spend / impressions) * 1000
 * Returns 0 if impressions is 0
 */
export function calculateCPM(spend: number, impressions: number): number {
  if (impressions === 0) return 0
  return (spend / impressions) * 1000
}

/**
 * Calculate CPA (Cost Per Acquisition/Conversion)
 * Formula: spend / conversions
 * Returns 0 if conversions is 0
 */
export function calculateCPA(spend: number, conversions: number): number {
  if (conversions === 0) return 0
  return spend / conversions
}

/**
 * Calculate profit
 * Formula: revenue - adSpend
 */
export function calculateProfit(revenue: number, adSpend: number): number {
  return revenue - adSpend
}

/**
 * Calculate net profit after ad spend and non-ad variable costs.
 */
export function calculateNetProfit(revenue: number, adSpend: number, nonAdCosts: number): number {
  return revenue - adSpend - nonAdCosts
}

/**
 * Calculate net ROI based on net profit.
 */
export function calculateNetROI(netProfit: number, adSpend: number): number | null {
  if (adSpend === 0) return null
  return (netProfit / adSpend) * 100
}

/**
 * Calculate net margin as a percentage of revenue.
 */
export function calculateNetMargin(netProfit: number, revenue: number): number {
  if (revenue === 0) return 0
  return (netProfit / revenue) * 100
}

/**
 * Calculate the ROAS needed to break even after non-ad costs and ad tax.
 */
export function calculateBreakEvenROAS(
  revenue: number,
  nonAdCostsExcludingAdTax: number,
  adTaxPercent: number = 0
): number | null {
  if (revenue <= 0) return null

  const maxAdSpendBeforeLoss = revenue - nonAdCostsExcludingAdTax
  if (maxAdSpendBeforeLoss <= 0) return null

  const adTaxMultiplier = 1 + (Number.isFinite(adTaxPercent) ? Math.max(0, adTaxPercent) / 100 : 0)
  return (revenue * adTaxMultiplier) / maxAdSpendBeforeLoss
}

/**
 * Calculate the maximum CPA that keeps orders profitable before ads and ad tax.
 */
export function calculateMaxProfitableCPA(
  revenue: number,
  nonAdCostsExcludingAdTax: number,
  paidOrders: number,
  adTaxPercent: number = 0
): number {
  if (paidOrders === 0) return 0
  const adTaxMultiplier = 1 + (Number.isFinite(adTaxPercent) ? Math.max(0, adTaxPercent) / 100 : 0)
  return Math.max(0, (revenue - nonAdCostsExcludingAdTax) / (paidOrders * adTaxMultiplier))
}

export function calculateCostBreakdown(
  revenue: number,
  adSpend: number,
  paidOrders: number,
  videoOrders: number,
  spotifyOrders: number,
  config: CostConfig,
  fixedMonthlyCostForPeriod: number = 0
): CostBreakdown {
  const paymentFees = revenue * (config.paymentFeePercent / 100) + paidOrders * config.paymentFixedFee
  const productionCosts = paidOrders * config.productionCostPerOrder
  const videoCosts = videoOrders * config.videoCostPerOrder
  const spotifyCosts = spotifyOrders * config.spotifyCostPerOrder
  const fixedMonthlyCosts = fixedMonthlyCostForPeriod
  const adTaxes = adSpend * (config.adTaxPercent / 100)
  const otherCosts = paidOrders * config.otherCostPerOrder
  const nonAdCosts = paymentFees + productionCosts + videoCosts + spotifyCosts + fixedMonthlyCosts + adTaxes + otherCosts

  return {
    paymentFees,
    productionCosts,
    videoCosts,
    spotifyCosts,
    fixedMonthlyCosts,
    adTaxes,
    otherCosts,
    nonAdCosts,
    totalCosts: adSpend + nonAdCosts,
  }
}

/**
 * Calculate all metrics from raw data
 */
export function calculateMetrics(
  spend: number,
  impressions: number,
  clicks: number,
  conversions: number
): TikTokMetrics {
  return {
    spend,
    impressions,
    clicks,
    ctr: calculateCTR(clicks, impressions),
    cpc: calculateCPC(spend, clicks),
    cpm: calculateCPM(spend, impressions),
    conversions,
    cpa: calculateCPA(spend, conversions),
  }
}

/**
 * Calculate ROI data from revenue and ad spend
 */
export function calculateROIData(
  revenue: number,
  adSpend: number,
  previousRevenue?: number,
  previousAdSpend?: number,
  paidOrders: number = 0,
  costBreakdown: CostBreakdown = calculateCostBreakdown(0, adSpend, 0, 0, 0, DEFAULT_COST_CONFIG),
  costConfig: CostConfig = DEFAULT_COST_CONFIG,
  previousNonAdCosts: number = 0
): ROIData {
  const grossProfit = calculateProfit(revenue, adSpend)
  const netProfit = calculateNetProfit(revenue, adSpend, costBreakdown.nonAdCosts)
  const roi = calculateROI(revenue, adSpend)
  const roas = calculateROAS(revenue, adSpend)
  const netRoi = calculateNetROI(netProfit, adSpend)
  const nonAdCostsExcludingAdTax = Math.max(0, costBreakdown.nonAdCosts - costBreakdown.adTaxes)

  let previousRoi: number | null = null
  let roiChange: number | null = null
  let previousNetRoi: number | null = null
  let netRoiChange: number | null = null

  if (previousRevenue !== undefined && previousAdSpend !== undefined && previousAdSpend > 0) {
    previousRoi = calculateROI(previousRevenue, previousAdSpend)
    if (roi !== null && previousRoi !== null) {
      roiChange = roi - previousRoi
    }

    const previousNetProfit = calculateNetProfit(previousRevenue, previousAdSpend, previousNonAdCosts)
    previousNetRoi = calculateNetROI(previousNetProfit, previousAdSpend)
    if (netRoi !== null && previousNetRoi !== null) {
      netRoiChange = netRoi - previousNetRoi
    }
  }

  return {
    revenue,
    adSpend,
    profit: grossProfit,
    grossProfit,
    netProfit,
    costs: costBreakdown,
    costConfig,
    paidOrders,
    averageOrderValue: paidOrders > 0 ? revenue / paidOrders : 0,
    costPerOrder: paidOrders > 0 ? costBreakdown.nonAdCosts / paidOrders : 0,
    netMargin: calculateNetMargin(netProfit, revenue),
    roi: roi ?? 0,
    netRoi: netRoi ?? 0,
    roas: roas ?? 0,
    breakEvenRoas: calculateBreakEvenROAS(revenue, nonAdCostsExcludingAdTax, costConfig.adTaxPercent),
    maxProfitableCpa: calculateMaxProfitableCPA(
      revenue,
      nonAdCostsExcludingAdTax,
      paidOrders,
      costConfig.adTaxPercent
    ),
    previousRoi,
    roiChange,
    previousNetRoi,
    netRoiChange,
    attributionModel: 'account_total',
    costWarnings: buildCostWarnings(costBreakdown, paidOrders),
  }
}

function buildCostWarnings(costBreakdown: CostBreakdown, paidOrders: number): string[] {
  if (paidOrders === 0) return []
  if (costBreakdown.nonAdCosts > 0) return []

  return [
    'Los costos variables estan en $0. Configura costos de pago, produccion o extras para ver utilidad neta real.',
  ]
}

function formatMultiplier(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'sin margen'
  return `${value.toFixed(2)}x`
}

function getCampaignDecision(campaign: TikTokCampaign, values: {
  estimatedNetProfit: number
  estimatedRoas: number
  cpa: number
  breakEvenRoas: number | null
  maxProfitableCpa: number
}): Pick<CampaignDecision, 'decision' | 'decisionLabel' | 'decisionReason'> {
  if (campaign.spend === 0) {
    return {
      decision: 'maintain',
      decisionLabel: 'Sin gasto',
      decisionReason: 'No hay inversion en el periodo.',
    }
  }

  if (campaign.conversions === 0) {
    const shouldPause = values.maxProfitableCpa > 0 && campaign.spend >= values.maxProfitableCpa
    return {
      decision: shouldPause ? 'pause' : 'review',
      decisionLabel: shouldPause ? 'Pausar' : 'Revisar',
      decisionReason: 'Tiene gasto pero no registra conversiones.',
    }
  }

  if (values.maxProfitableCpa > 0 && values.cpa > values.maxProfitableCpa * 1.25) {
    return {
      decision: 'pause',
      decisionLabel: 'Pausar',
      decisionReason: `CPA ${formatCurrency(values.cpa)} supera el maximo rentable ${formatCurrency(values.maxProfitableCpa)}.`,
    }
  }

  if (values.maxProfitableCpa > 0 && values.cpa > values.maxProfitableCpa) {
    return {
      decision: 'review',
      decisionLabel: 'Revisar',
      decisionReason: `CPA ${formatCurrency(values.cpa)} esta por encima del maximo rentable.`,
    }
  }

  const breakEvenRoas = values.breakEvenRoas === null ? null : Math.max(values.breakEvenRoas, 1)
  if (breakEvenRoas !== null && values.estimatedNetProfit > 0 && values.estimatedRoas >= breakEvenRoas * 1.2) {
    return {
      decision: 'scale',
      decisionLabel: 'Escalar',
      decisionReason: `ROAS ${formatMultiplier(values.estimatedRoas)} supera equilibrio ${formatMultiplier(values.breakEvenRoas)}.`,
    }
  }

  if (values.estimatedNetProfit >= 0) {
    return {
      decision: 'maintain',
      decisionLabel: 'Mantener',
      decisionReason: 'Rentable, pero sin margen suficiente para escalar agresivo.',
    }
  }

  return {
    decision: 'review',
    decisionLabel: 'Revisar',
    decisionReason: 'La utilidad estimada es negativa.',
  }
}

/**
 * Build campaign-level decisions from account profitability.
 * Revenue and non-ad costs are estimated by conversion share until order attribution exists.
 */
export function buildCampaignDecisions(
  campaigns: TikTokCampaign[],
  roi: ROIData | null
): CampaignDecision[] {
  const totalConversions = campaigns.reduce((sum, campaign) => sum + campaign.conversions, 0)

  return campaigns.map((campaign) => {
    const conversionShare = roi && totalConversions > 0
      ? campaign.conversions / totalConversions
      : 0
    const estimatedRevenue = (roi?.revenue || 0) * conversionShare
    const estimatedNonAdCosts = (roi?.costs?.nonAdCosts || 0) * conversionShare
    const estimatedNetProfit = estimatedRevenue - estimatedNonAdCosts - campaign.spend
    const estimatedRoas = campaign.spend > 0 ? estimatedRevenue / campaign.spend : 0
    const estimatedNetRoi = campaign.spend > 0 ? (estimatedNetProfit / campaign.spend) * 100 : 0
    const cpa = calculateCPA(campaign.spend, campaign.conversions)
    const breakEvenRoas = roi ? roi.breakEvenRoas : 0
    const maxProfitableCpa = roi?.maxProfitableCpa || 0
    const decision = getCampaignDecision(campaign, {
      estimatedNetProfit,
      estimatedRoas,
      cpa,
      breakEvenRoas,
      maxProfitableCpa,
    })

    return {
      ...campaign,
      estimatedRevenue,
      estimatedNonAdCosts,
      estimatedNetProfit,
      estimatedRoas,
      estimatedNetRoi,
      cpa,
      breakEvenRoas,
      maxProfitableCpa,
      ...decision,
    }
  })
}

export function buildTikTokDecisionAlerts(
  metrics: TikTokMetrics | null,
  roi: ROIData | null,
  decisions: CampaignDecision[]
): TikTokDecisionAlert[] {
  const alerts: TikTokDecisionAlert[] = []

  if (!metrics || !roi) return alerts

  for (const warning of roi.costWarnings) {
    alerts.push({
      id: `cost-${alerts.length}`,
      severity: 'warning',
      title: 'Costos sin calibrar',
      message: warning,
      action: 'Agrega variables TIKTOK_*_COST_* y TIKTOK_PAYMENT_FEE_PERCENT en el entorno.',
    })
  }

  if (metrics.spend > 0 && roi.netProfit < 0) {
    alerts.push({
      id: 'net-loss',
      severity: 'critical',
      title: 'Periodo con perdida neta',
      message: `La utilidad neta estimada es ${formatCurrency(roi.netProfit)} despues de ads y costos.`,
      action: 'Baja presupuesto en campanas con CPA alto y revisa costos antes de escalar.',
    })
  }

  if (metrics.spend > 0 && roi.breakEvenRoas !== null && roi.breakEvenRoas > 0 && roi.roas < roi.breakEvenRoas) {
    alerts.push({
      id: 'below-break-even',
      severity: 'critical',
      title: 'ROAS debajo del equilibrio',
      message: `ROAS actual ${formatMultiplier(roi.roas)} vs equilibrio ${formatMultiplier(roi.breakEvenRoas)}.`,
      action: 'Pausa o ajusta campanas debajo del CPA maximo rentable.',
    })
  }

  const zeroConversionSpend = decisions
    .filter((campaign) => campaign.spend > 0 && campaign.conversions === 0)
    .reduce((sum, campaign) => sum + campaign.spend, 0)

  if (zeroConversionSpend > 0) {
    alerts.push({
      id: 'zero-conversion-spend',
      severity: zeroConversionSpend >= roi.maxProfitableCpa && roi.maxProfitableCpa > 0 ? 'critical' : 'warning',
      title: 'Gasto sin conversiones',
      message: `${formatCurrency(zeroConversionSpend)} gastados en campanas sin conversiones registradas.`,
      action: 'Revisa creativos, evento de compra y segmentacion antes de seguir invirtiendo.',
    })
  }

  const pauseCount = decisions.filter((campaign) => campaign.decision === 'pause').length
  if (pauseCount > 0) {
    alerts.push({
      id: 'pause-candidates',
      severity: 'warning',
      title: 'Campanas para pausar',
      message: `${pauseCount} campana(s) estan por encima del CPA maximo o sin conversiones suficientes.`,
      action: 'Pausa las peores y reasigna presupuesto a campanas rentables.',
    })
  }

  const scaleCount = decisions.filter((campaign) => campaign.decision === 'scale').length
  if (scaleCount > 0) {
    alerts.push({
      id: 'scale-candidates',
      severity: 'success',
      title: 'Oportunidad de escalar',
      message: `${scaleCount} campana(s) superan el ROAS de equilibrio con margen.`,
      action: 'Sube presupuesto gradualmente y vigila que el CPA no se deteriore.',
    })
  } else if (roi.netProfit > 0 && alerts.every((alert) => alert.severity !== 'critical')) {
    alerts.push({
      id: 'profitable-period',
      severity: 'success',
      title: 'Periodo rentable',
      message: `Utilidad neta estimada de ${formatCurrency(roi.netProfit)} con margen ${formatPercentage(roi.netMargin)}.`,
      action: 'Mantener presupuesto y buscar mejoras de conversion.',
    })
  }

  const severityOrder = { critical: 0, warning: 1, success: 2, info: 3 }
  return alerts
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, 6)
}

/**
 * Format currency for display (MXN)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Format large numbers with K/M suffix
 */
export function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return value.toLocaleString('es-MX')
}

/**
 * Sort campaigns by spend in descending order
 */
export function sortCampaignsBySpend<T extends { spend: number }>(campaigns: T[]): T[] {
  return [...campaigns].sort((a, b) => b.spend - a.spend)
}

/**
 * Check if TikTok credentials are configured
 */
export function hasCredentials(): boolean {
  return !!(
    process.env.TIKTOK_ACCESS_TOKEN &&
    process.env.TIKTOK_ADVERTISER_ID
  )
}
