"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { KPIData } from "@/lib/statistics-types"
import { calculatePercentageChange } from "@/lib/statistics-utils"
import {
  DollarSign,
  CheckCircle,
  CreditCard,
  Clock,
  TrendingUp,
  TrendingDown,
  Percent,
  ShoppingCart
} from "lucide-react"

interface KPICardsProps {
  data: KPIData
  previousData: KPIData | null
  loading: boolean
}

interface KPICardProps {
  title: string
  value: string
  change: number | null
  icon: React.ReactNode
  loading: boolean
}

function KPICard({ title, value, change, icon, loading }: KPICardProps) {
  const isPositive = change !== null && change >= 0
  const changeColor = isPositive ? "text-green-600" : "text-red-600"
  const ChangeIcon = isPositive ? TrendingUp : TrendingDown

  if (loading) {
    return (
      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
          <div className="h-8 w-8 bg-white/10 rounded-lg animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-8 w-32 bg-white/10 rounded animate-pulse mb-2" />
          <div className="h-3 w-20 bg-white/10 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-md hover:bg-white/10 transition-all duration-300 group overflow-hidden relative">
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
        <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-white transition-colors">
          {title}
        </CardTitle>
        <div className="p-2 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-300">
          <div className="text-white/80 group-hover:text-white transition-colors">
            {icon}
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="text-2xl font-bold text-white tracking-tight mb-1">{value}</div>
        {change !== null && (
          <p className={`text-xs flex items-center gap-1 font-medium ${isPositive ? "text-emerald-400" : "text-rose-400"
            }`}>
            <span className={`flex items-center justify-center w-4 h-4 rounded-full ${isPositive ? "bg-emerald-500/20" : "bg-rose-500/20"
              }`}>
              <ChangeIcon className="h-3 w-3" />
            </span>
            {change >= 0 ? "+" : ""}{change.toFixed(1)}%
            <span className="text-muted-foreground font-normal ml-1">vs período anterior</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function KPICards({ data, previousData, loading }: KPICardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const revenueChange = previousData
    ? calculatePercentageChange(data.totalRevenue, previousData.totalRevenue)
    : null

  const completedChange = previousData
    ? calculatePercentageChange(data.completedOrders, previousData.completedOrders)
    : null

  const paidChange = previousData
    ? calculatePercentageChange(data.paidOrders, previousData.paidOrders)
    : null

  const pendingChange = previousData
    ? calculatePercentageChange(data.pendingOrders, previousData.pendingOrders)
    : null

  const avgChange = previousData
    ? calculatePercentageChange(data.averageOrderValue, previousData.averageOrderValue)
    : null

  const conversionChange = previousData
    ? calculatePercentageChange(data.conversionRate, previousData.conversionRate)
    : null

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <KPICard
        title="Ingresos Totales"
        value={formatCurrency(data.totalRevenue)}
        change={revenueChange}
        icon={<DollarSign className="h-4 w-4" />}
        loading={loading}
      />
      <KPICard
        title="Órdenes Completadas"
        value={data.completedOrders.toString()}
        change={completedChange}
        icon={<CheckCircle className="h-4 w-4" />}
        loading={loading}
      />
      <KPICard
        title="Órdenes Pagadas"
        value={data.paidOrders.toString()}
        change={paidChange}
        icon={<CreditCard className="h-4 w-4" />}
        loading={loading}
      />
      <KPICard
        title="Pagos Pendientes"
        value={data.pendingOrders.toString()}
        change={pendingChange}
        icon={<Clock className="h-4 w-4" />}
        loading={loading}
      />
      <KPICard
        title="Valor Promedio"
        value={formatCurrency(data.averageOrderValue)}
        change={avgChange}
        icon={<ShoppingCart className="h-4 w-4" />}
        loading={loading}
      />
      <KPICard
        title="Tasa de Conversión"
        value={`${data.conversionRate.toFixed(1)}%`}
        change={conversionChange}
        icon={<Percent className="h-4 w-4" />}
        loading={loading}
      />
    </div>
  )
}
