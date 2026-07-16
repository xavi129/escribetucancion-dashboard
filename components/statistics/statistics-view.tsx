"use client"

import { useStatistics } from "@/hooks/use-statistics"
import { TimePeriod } from "@/lib/statistics-types"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, RefreshCw } from "lucide-react"
import PeriodSelector from "./period-selector"
import KPICards from "./kpi-cards"
import RevenueChart from "./revenue-chart"
import StatusDistribution from "./status-distribution"
import TopMetrics from "./top-metrics"
import TikTokAdsKPIs from "./tiktok-ads-kpis"

interface StatisticsViewProps {
  initialPeriod?: TimePeriod
}

export default function StatisticsView({ initialPeriod = "weekly" }: StatisticsViewProps) {
  const { period, loading, error, data, setPeriod, retry } = useStatistics(initialPeriod)

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            Estadísticas de Ventas
          </h2>
          <p className="text-muted-foreground mt-1">
            Métricas y análisis del rendimiento del negocio
          </p>
        </div>
        <PeriodSelector selected={period} onChange={setPeriod} />
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={retry} className="ml-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <KPICards
        data={data.kpis}
        previousData={data.previousKpis}
        loading={loading}
      />

      {/* TikTok Ads KPIs */}
      <TikTokAdsKPIs period={period} />

      {/* Revenue Chart */}
      <RevenueChart
        data={data.revenueSeries}
        period={period}
        loading={loading}
      />

      {/* Status Distribution */}
      <StatusDistribution
        orderStatusData={data.statusDistribution.orderStatus}
        paymentStatusData={data.statusDistribution.paymentStatus}
        loading={loading}
      />

      {/* Top Metrics */}
      <TopMetrics
        topGenres={data.topMetrics.topGenres}
        topCountries={data.topMetrics.topCountries}
        deliveryTypes={data.topMetrics.deliveryTypes}
        loading={loading}
      />
    </div>
  )
}
