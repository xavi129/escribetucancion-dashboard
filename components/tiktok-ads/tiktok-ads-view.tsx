"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { TimePeriod } from "@/lib/statistics-types"
import { TikTokMetrics, TikTokCampaign, DailySpendPoint, ROIData } from "@/lib/tiktok-types"
import { buildCampaignDecisions, buildTikTokDecisionAlerts } from "@/lib/tiktok-utils"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, RefreshCw, Settings } from "lucide-react"
import PeriodSelector from "@/components/statistics/period-selector"
import AdsMetricsCards from "./ads-metrics-cards"
import ROIAnalysis from "./roi-analysis"
import DecisionAlerts from "./decision-alerts"
import SpendRevenueChart from "./spend-revenue-chart"
import CampaignDecisionTable from "./campaign-decision-table"

interface TikTokAdsState {
  loading: boolean
  error: string | null
  warnings: string[]
  configured: boolean
  metrics: TikTokMetrics | null
  roi: ROIData | null
  campaigns: TikTokCampaign[]
  dailySpend: DailySpendPoint[]
}

export default function TikTokAdsView() {
  const [period, setPeriod] = useState<TimePeriod>("weekly")
  const [state, setState] = useState<TikTokAdsState>({
    loading: true,
    error: null,
    warnings: [],
    configured: true,
    metrics: null,
    roi: null,
    campaigns: [],
    dailySpend: [],
  })

  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null, warnings: [] }))

    try {
      // Fetch all data in parallel
      const [metricsRes, campaignsRes, dailySpendRes] = await Promise.all([
        fetch(`/api/tiktok/metrics?period=${period}`),
        fetch(`/api/tiktok/campaigns?period=${period}`),
        fetch(`/api/tiktok/daily-spend?period=${period}`),
      ])

      const [metricsData, campaignsData, dailySpendData] = await Promise.all([
        metricsRes.json(),
        campaignsRes.json(),
        dailySpendRes.json(),
      ])

      // Check if configured
      if (metricsData.configured === false) {
        setState(prev => ({
          ...prev,
          loading: false,
          configured: false,
        }))
        return
      }

      // Check for errors
      if (!metricsData.success) {
        throw new Error(metricsData.error || 'Error fetching metrics')
      }

      const warnings: string[] = []
      if (!campaignsData.success) {
        warnings.push(`Campanas: ${campaignsData.error || 'No se pudieron cargar las campanas'}`)
      }
      if (!dailySpendData.success) {
        warnings.push(`Gasto diario: ${dailySpendData.error || 'No se pudo cargar el gasto diario'}`)
      }

      setState({
        loading: false,
        error: null,
        warnings,
        configured: true,
        metrics: metricsData.data?.metrics || null,
        roi: metricsData.data?.roi || null,
        campaigns: campaignsData.data?.campaigns || [],
        dailySpend: dailySpendData.data?.dailySpend || [],
      })
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Error fetching TikTok data',
        warnings: [],
      }))
    }
  }, [period])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const campaignDecisions = useMemo(
    () => buildCampaignDecisions(state.campaigns, state.roi),
    [state.campaigns, state.roi]
  )

  const decisionAlerts = useMemo(
    () => buildTikTokDecisionAlerts(state.metrics, state.roi, campaignDecisions),
    [state.metrics, state.roi, campaignDecisions]
  )

  // Not configured state
  if (!state.configured) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">TikTok Ads</h2>
            <p className="text-muted-foreground">
              Métricas y análisis de publicidad
            </p>
          </div>
        </div>
        <Alert>
          <Settings className="h-4 w-4" />
          <AlertTitle>Configuración requerida</AlertTitle>
          <AlertDescription>
            Para ver las métricas de TikTok Ads, configura las siguientes variables de entorno:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><code className="bg-muted px-1 rounded">TIKTOK_ACCESS_TOKEN</code></li>
              <li><code className="bg-muted px-1 rounded">TIKTOK_ADVERTISER_ID</code></li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            TikTok Ads
            <span className="text-xs bg-pink-100 text-pink-800 px-2 py-0.5 rounded">Beta</span>
          </h2>
          <p className="text-muted-foreground">
            Métricas y análisis de publicidad
          </p>
        </div>
        <PeriodSelector selected={period} onChange={setPeriod} />
      </div>

      {/* Error State */}
      {state.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{state.error}</span>
            <Button variant="outline" size="sm" onClick={fetchData} className="ml-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {state.warnings.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Datos parciales</AlertTitle>
          <AlertDescription>
            <div className="space-y-1">
              {state.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Metrics Cards */}
      <AdsMetricsCards metrics={state.metrics} loading={state.loading} />

      {/* Decision Alerts */}
      <DecisionAlerts alerts={decisionAlerts} loading={state.loading} />

      {/* ROI Analysis */}
      <ROIAnalysis roi={state.roi} loading={state.loading} />

      {/* Spend vs Revenue Chart */}
      <SpendRevenueChart data={state.dailySpend} loading={state.loading} />

      {/* Campaign Decision Table */}
      <CampaignDecisionTable campaigns={campaignDecisions} loading={state.loading} />
    </div>
  )
}
