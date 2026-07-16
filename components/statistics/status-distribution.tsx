"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusCount } from "@/lib/statistics-types"
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  TooltipProps,
} from "recharts"

interface StatusDistributionProps {
  orderStatusData: StatusCount[]
  paymentStatusData: StatusCount[]
  loading: boolean
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  new: "#3b82f6",
  in_progress: "#eab308",
  completed: "#22c55e",
  cancelled: "#ef4444",
  lead: "#a855f7",
  early_lead: "#6366f1",
  contacted: "#06b6d4",
  upload_spotify: "#10b981",
  confirmed: "#059669",
  error: "#dc2626",
  plantilla: "#f59e0b",
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: "#eab308",
  paid: "#22c55e",
  refunded: "#ef4444",
}

const STATUS_LABELS: Record<string, string> = {
  new: "Nuevo",
  in_progress: "En Progreso",
  completed: "Completado",
  cancelled: "Cancelado",
  lead: "Lead",
  early_lead: "Lead Temprano",
  contacted: "Contactado",
  upload_spotify: "Subir Spotify",
  confirmed: "Confirmado",
  error: "Error",
  plantilla: "Plantilla",
  pending: "Pendiente",
  paid: "Pagado",
  refunded: "Reembolsado",
}

function CustomPieTooltip({ active, payload }: TooltipProps<number, string>) {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload
    return (
      <div className="bg-black/80 backdrop-blur-xl p-3 border border-white/10 rounded-xl shadow-2xl">
        <p className="font-medium text-white">{STATUS_LABELS[data.status] || data.status}</p>
        <p className="text-sm text-white/80">Cantidad: <span className="font-bold text-white">{data.count}</span></p>
        <p className="text-sm text-white/60">{data.percentage.toFixed(1)}%</p>
      </div>
    )
  }
  return null
}

function CustomBarTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload
    return (
      <div className="bg-black/80 backdrop-blur-xl p-3 border border-white/10 rounded-xl shadow-2xl">
        <p className="font-medium text-white">{STATUS_LABELS[label] || label}</p>
        <p className="text-sm text-white/80">Cantidad: <span className="font-bold text-white">{data.count}</span></p>
        <p className="text-sm text-white/60">{data.percentage.toFixed(1)}%</p>
      </div>
    )
  }
  return null
}

export default function StatusDistribution({
  orderStatusData,
  paymentStatusData,
  loading
}: StatusDistributionProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <div className="h-5 w-40 bg-white/10 rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="h-[250px] bg-white/5 rounded animate-pulse" />
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardHeader>
            <div className="h-5 w-40 bg-white/10 rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="h-[250px] bg-white/5 rounded animate-pulse" />
          </CardContent>
        </Card>
      </div>
    )
  }

  const pieData = orderStatusData.map(item => ({
    ...item,
    name: STATUS_LABELS[item.status] || item.status,
    fill: ORDER_STATUS_COLORS[item.status] || "#94a3b8",
  }))

  const barData = paymentStatusData.map(item => ({
    ...item,
    name: STATUS_LABELS[item.status] || item.status,
    fill: PAYMENT_STATUS_COLORS[item.status] || "#94a3b8",
  }))

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="bg-white/5 border-white/10 backdrop-blur-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-white">Estado de Órdenes</CardTitle>
          <CardDescription className="text-white/60">Distribución por estado de procesamiento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="count"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} className="stroke-transparent" />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend
                  verticalAlign="middle"
                  align="right"
                  layout="vertical"
                  iconType="circle"
                  formatter={(value, entry) => {
                    const item = pieData.find(d => d.name === value)
                    return <span className="text-white/80 text-sm ml-2">{value} ({item?.count || 0})</span>
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10 backdrop-blur-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-white">Estado de Pagos</CardTitle>
          <CardDescription className="text-white/60">Distribución por estado de pago</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} className="stroke-white/10" />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "rgba(255,255,255,0.7)" }}
                  width={100}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={32}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
