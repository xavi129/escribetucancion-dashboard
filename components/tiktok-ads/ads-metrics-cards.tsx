"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TikTokMetrics } from "@/lib/tiktok-types"
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/tiktok-utils"
import { 
  DollarSign, 
  Eye, 
  MousePointer, 
  Percent,
  Target,
  TrendingUp,
} from "lucide-react"

interface AdsMetricsCardsProps {
  metrics: TikTokMetrics | null
  loading: boolean
}

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  icon: React.ReactNode
  loading: boolean
}

function MetricCard({ title, value, subtitle, icon, loading }: MetricCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-7 w-24 bg-gray-200 rounded animate-pulse mb-1" />
          <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}

export default function AdsMetricsCards({ metrics, loading }: AdsMetricsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Gasto Total"
        value={formatCurrency(metrics?.spend || 0)}
        icon={<DollarSign className="h-4 w-4" />}
        loading={loading}
      />
      <MetricCard
        title="Impresiones"
        value={formatNumber(metrics?.impressions || 0)}
        icon={<Eye className="h-4 w-4" />}
        loading={loading}
      />
      <MetricCard
        title="Clics"
        value={formatNumber(metrics?.clicks || 0)}
        subtitle={`CTR: ${formatPercentage(metrics?.ctr || 0)}`}
        icon={<MousePointer className="h-4 w-4" />}
        loading={loading}
      />
      <MetricCard
        title="Conversiones"
        value={formatNumber(metrics?.conversions || 0)}
        subtitle={`CPA: ${formatCurrency(metrics?.cpa || 0)}`}
        icon={<Target className="h-4 w-4" />}
        loading={loading}
      />
      <MetricCard
        title="CPC"
        value={formatCurrency(metrics?.cpc || 0)}
        subtitle="Costo por clic"
        icon={<MousePointer className="h-4 w-4" />}
        loading={loading}
      />
      <MetricCard
        title="CPM"
        value={formatCurrency(metrics?.cpm || 0)}
        subtitle="Costo por 1000 impresiones"
        icon={<Eye className="h-4 w-4" />}
        loading={loading}
      />
      <MetricCard
        title="CTR"
        value={formatPercentage(metrics?.ctr || 0)}
        subtitle="Tasa de clics"
        icon={<Percent className="h-4 w-4" />}
        loading={loading}
      />
      <MetricCard
        title="CPA"
        value={formatCurrency(metrics?.cpa || 0)}
        subtitle="Costo por conversión"
        icon={<TrendingUp className="h-4 w-4" />}
        loading={loading}
      />
    </div>
  )
}
