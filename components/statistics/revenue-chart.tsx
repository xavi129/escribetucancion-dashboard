"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RevenueDataPoint, TimePeriod } from "@/lib/statistics-types"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from "recharts"

interface RevenueChartProps {
  data: RevenueDataPoint[]
  period: TimePeriod
  loading: boolean
}

const periodLabels: Record<TimePeriod, string> = {
  daily: "por hora",
  weekly: "por día",
  monthly: "por día",
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload as RevenueDataPoint

    return (
      <div className="bg-black/80 backdrop-blur-xl p-4 border border-white/10 rounded-xl shadow-2xl">
        <p className="font-medium text-white mb-2">{label}</p>
        <div className="space-y-1">
          <p className="text-sm text-purple-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            Ingresos: <span className="text-white font-bold">{new Intl.NumberFormat('es-MX', {
              style: 'currency',
              currency: 'MXN',
              minimumFractionDigits: 0,
            }).format(data?.revenue || 0)}</span>
          </p>
          <p className="text-sm text-blue-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Órdenes: <span className="text-white font-bold">{data?.orderCount || 0}</span>
          </p>
        </div>
      </div>
    )
  }
  return null
}
export default function RevenueChart({ data, period, loading }: RevenueChartProps) {
  if (loading) {
    return (
      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader>
          <div className="h-5 w-40 bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-32 bg-white/10 rounded animate-pulse mt-1" />
        </CardHeader>
        <CardContent>
          <div className="h-[300px] bg-white/5 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  const formatYAxis = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`
    }
    return `$${value}`
  }

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-md shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl text-white">Tendencia de Ingresos</CardTitle>
        <CardDescription className="text-white/60">
          Ingresos {periodLabels[period]} del período seleccionado
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-white/10" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "rgba(255,255,255,0.5)" }}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fontSize: 12, fill: "rgba(255,255,255,0.5)" }}
                tickLine={false}
                axisLine={false}
                dx={-10}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#8b5cf6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorRevenue)"
                activeDot={{ r: 6, strokeWidth: 0, fill: "#fff" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
