"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ROIData } from "@/lib/tiktok-types"
import { formatCurrency, formatPercentage } from "@/lib/tiktok-utils"
import { DollarSign, Minus, Receipt, Target, TrendingDown, TrendingUp } from "lucide-react"

interface ROIAnalysisProps {
  roi: ROIData | null
  loading: boolean
}

export default function ROIAnalysis({ roi, loading }: ROIAnalysisProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mt-1" />
        </CardHeader>
        <CardContent>
          <div className="h-[260px] bg-gray-100 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  const isPositiveNet = (roi?.netProfit || 0) >= 0
  const roiColor = isPositiveNet ? "text-green-600" : "text-red-600"
  const roiBgColor = isPositiveNet ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"
  const ROIIcon = isPositiveNet ? TrendingUp : TrendingDown

  const changeIsPositive = (roi?.netRoiChange || 0) >= 0
  const changeColor = changeIsPositive ? "text-green-600" : "text-red-600"
  const ChangeIcon = changeIsPositive ? TrendingUp : TrendingDown
  const breakEvenRoas = roi?.breakEvenRoas ?? null
  const costItems = [
    { label: "Pagos", value: roi?.costs?.paymentFees || 0 },
    { label: "Produccion", value: roi?.costs?.productionCosts || 0 },
    { label: "Video", value: roi?.costs?.videoCosts || 0 },
    { label: "SendPulse", value: roi?.costs?.fixedMonthlyCosts || 0 },
    { label: "IVA Ads", value: roi?.costs?.adTaxes || 0 },
    { label: "Otros", value: roi?.costs?.otherCosts || 0 },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rentabilidad real</CardTitle>
        <CardDescription>Ingresos, ads y costos variables del periodo</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className={`p-6 rounded-lg ${roiBgColor}`}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Beneficio neto</p>
              <div className={`text-4xl font-bold ${roiColor} flex items-center gap-2`}>
                <ROIIcon className="h-8 w-8" />
                {formatCurrency(roi?.netProfit || 0)}
              </div>
              {roi?.netRoiChange !== null && roi?.netRoiChange !== undefined && (
                <p className={`text-sm flex items-center gap-1 mt-2 ${changeColor}`}>
                  <ChangeIcon className="h-4 w-4" />
                  {changeIsPositive ? "+" : ""}
                  {roi.netRoiChange.toFixed(1)} pts ROI neto vs periodo anterior
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 text-left sm:grid-cols-3 lg:text-right">
              <div>
                <p className="text-sm text-muted-foreground mb-1">ROI neto</p>
                <p className="text-2xl font-bold">{formatPercentage(roi?.netRoi || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">ROAS actual</p>
                <p className="text-2xl font-bold">{(roi?.roas || 0).toFixed(2)}x</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">ROAS equilibrio</p>
                <p className="text-2xl font-bold">
                  {breakEvenRoas !== null && Number.isFinite(breakEvenRoas) ? `${breakEvenRoas.toFixed(2)}x` : "Sin margen"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm font-medium">Ingresos</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(roi?.revenue || 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">{roi?.paidOrders || 0} pedidos pagados</p>
          </div>

          <div className="p-4 bg-pink-50 dark:bg-pink-950/20 rounded-lg">
            <div className="flex items-center gap-2 text-pink-600 mb-2">
              <Minus className="h-4 w-4" />
              <span className="text-sm font-medium">Gasto en Ads</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(roi?.adSpend || 0)}</p>
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <Receipt className="h-4 w-4" />
              <span className="text-sm font-medium">Costos variables</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(roi?.costs?.nonAdCosts || 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatCurrency(roi?.costPerOrder || 0)} por pedido</p>
          </div>

          <div className={`p-4 rounded-lg ${isPositiveNet ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
            <div className={`flex items-center gap-2 mb-2 ${isPositiveNet ? "text-green-600" : "text-red-600"}`}>
              {isPositiveNet ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span className="text-sm font-medium">Utilidad neta</span>
            </div>
            <p className={`text-xl font-bold ${isPositiveNet ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(roi?.netProfit || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Margen {formatPercentage(roi?.netMargin || 0)}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-6">
          {costItems.map((item) => (
            <div key={item.label} className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-semibold">{formatCurrency(item.value)}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Target className="h-4 w-4" />
            <span className="text-sm font-medium">CPA maximo rentable</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(roi?.maxProfitableCpa || 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Si una venta cuesta mas que esto en ads, esa venta pierde dinero antes de costos fijos.
          </p>
        </div>

        {(roi?.costWarnings || []).map((warning) => (
          <Alert key={warning}>
            <AlertDescription>{warning}</AlertDescription>
          </Alert>
        ))}
      </CardContent>
    </Card>
  )
}
