"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { RankedItem } from "@/lib/statistics-types"
import { Music, Globe, Truck } from "lucide-react"

interface TopMetricsProps {
  topGenres: RankedItem[]
  topCountries: RankedItem[]
  deliveryTypes: RankedItem[]
  loading: boolean
}

interface RankedListProps {
  title: string
  description: string
  items: RankedItem[]
  icon: React.ReactNode
  loading: boolean
}

function RankedList({ title, description, items, icon, loading }: RankedListProps) {
  if (loading) {
    return (
      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center gap-2">
          <div className="h-5 w-5 bg-white/10 rounded animate-pulse" />
          <div>
            <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
            <div className="h-4 w-24 bg-white/10 rounded animate-pulse mt-1" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
              <div className="h-2 w-full bg-white/5 rounded animate-pulse" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (items.length === 0) {
    return (
      <Card className="bg-white/5 border-white/10 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="p-2 rounded-lg bg-white/5 text-white/60">{icon}</div>
          <div>
            <CardTitle className="text-base text-white">{title}</CardTitle>
            <CardDescription className="text-white/60">{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-white/40 text-center py-8">
            No hay datos disponibles
          </p>
        </CardContent>
      </Card>
    )
  }

  const maxCount = Math.max(...items.map(item => item.count))

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-md shadow-xl hover:bg-white/10 transition-colors duration-300">
      <CardHeader className="flex flex-row items-center gap-3 pb-4">
        <div className="p-2 rounded-lg bg-gradient-to-br from-white/10 to-white/5 border border-white/10 text-white shadow-inner">
          {icon}
        </div>
        <div>
          <CardTitle className="text-base text-white">{title}</CardTitle>
          <CardDescription className="text-white/60">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item, index) => (
          <div key={item.name} className="space-y-2 group">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-3">
                <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${index === 0 ? "bg-yellow-500/20 text-yellow-400" :
                    index === 1 ? "bg-gray-400/20 text-gray-300" :
                      index === 2 ? "bg-orange-700/20 text-orange-400" :
                        "bg-white/5 text-white/40"
                  }`}>
                  {index + 1}
                </span>
                <span className="truncate max-w-[150px] text-white/90 font-medium group-hover:text-white transition-colors" title={item.name}>
                  {item.name}
                </span>
              </span>
              <span className="text-white/60 text-xs">
                {item.count} <span className="text-white/40">({item.percentage.toFixed(1)}%)</span>
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500 ease-out group-hover:brightness-110"
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function TopMetrics({
  topGenres,
  topCountries,
  deliveryTypes,
  loading
}: TopMetricsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <RankedList
        title="Top Géneros"
        description="Géneros más solicitados"
        items={topGenres}
        icon={<Music className="h-5 w-5" />}
        loading={loading}
      />
      <RankedList
        title="Top Países"
        description="Países con más órdenes"
        items={topCountries}
        icon={<Globe className="h-5 w-5" />}
        loading={loading}
      />
      <RankedList
        title="Tipos de Entrega"
        description="Distribución de entregas"
        items={deliveryTypes}
        icon={<Truck className="h-5 w-5" />}
        loading={loading}
      />
    </div>
  )
}
