"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useTikTokMetrics } from "@/hooks/use-tiktok-metrics"
import { TimePeriod } from "@/lib/statistics-types"
import { formatCurrency, formatPercentage } from "@/lib/tiktok-utils"
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Percent,
  RefreshCw,
  AlertCircle,
  Settings,
} from "lucide-react"

interface TikTokAdsKPIsProps {
  period: TimePeriod
}

interface KPICardProps {
  title: string
  value: string
  change?: number | null
  icon: React.ReactNode
  loading: boolean
}

function KPICard({ title, value, change, icon, loading }: KPICardProps) {
  const isPositive = change !== null && change !== undefined && change >= 0
  const changeColor = isPositive ? "text-green-600" : "text-red-600"
  const ChangeIcon = isPositive ? TrendingUp : TrendingDown

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20 border-pink-200 dark:border-pink-800">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-pink-600">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== null && change !== undefined && (
          <p className={`text-xs flex items-center gap-1 mt-1 ${changeColor}`}>
            <ChangeIcon className="h-3 w-3" />
            {change >= 0 ? "+" : ""}{change.toFixed(1)}% vs período anterior
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function TikTokAdsKPIs({ period }: TikTokAdsKPIsProps) {
  const { loading, error, configured, metrics, previousMetrics, roi, retry } = useTikTokMetrics(period)

  // Not configured state
  if (!configured) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">TikTok Ads</span>
          <span className="text-xs bg-pink-100 text-pink-800 px-2 py-0.5 rounded">Beta</span>
        </div>
        <Alert>
          <Settings className="h-4 w-4" />
          <AlertDescription>
            Configura las credenciales de TikTok Ads en las variables de entorno para ver métricas de publicidad.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Error state
  if (error && !loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">TikTok Ads</span>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={retry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const spendChange = metrics && previousMetrics && previousMetrics.spend > 0
    ? ((metrics.spend - previousMetrics.spend) / previousMetrics.spend) * 100
    : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold">TikTok Ads</span>
        <span className="text-xs bg-pink-100 text-pink-800 px-2 py-0.5 rounded">Beta</span>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <KPICard
          title="Gasto en Ads"
          value={formatCurrency(metrics?.spend || 0)}
          change={spendChange}
          icon={<DollarSign className="h-4 w-4" />}
          loading={loading}
        />
        <KPICard
          title="ROI Neto"
          value={formatPercentage(roi?.netRoi || 0)}
          change={roi?.netRoiChange}
          icon={<TrendingUp className="h-4 w-4" />}
          loading={loading}
        />
        <KPICard
          title="ROAS"
          value={`${(roi?.roas || 0).toFixed(2)}x`}
          change={null}
          icon={<Percent className="h-4 w-4" />}
          loading={loading}
        />
      </div>
    </div>
  )
}
