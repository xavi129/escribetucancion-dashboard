"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TikTokDecisionAlert } from "@/lib/tiktok-types"
import { AlertCircle, CheckCircle2, Info } from "lucide-react"

interface DecisionAlertsProps {
  alerts: TikTokDecisionAlert[]
  loading: boolean
}

const severityStyles = {
  critical: {
    className: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-100",
    icon: AlertCircle,
  },
  warning: {
    className: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100",
    icon: AlertCircle,
  },
  success: {
    className: "border-green-200 bg-green-50 text-green-900 dark:border-green-900/60 dark:bg-green-950/20 dark:text-green-100",
    icon: CheckCircle2,
  },
  info: {
    className: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-100",
    icon: Info,
  },
}

export default function DecisionAlerts({ alerts, loading }: DecisionAlertsProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-56 bg-gray-200 rounded animate-pulse mt-1" />
        </CardHeader>
        <CardContent>
          <div className="h-[120px] bg-gray-100 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (alerts.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertas de decision</CardTitle>
        <CardDescription>Senales accionables para el presupuesto de TikTok Ads</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-2">
        {alerts.map((alert) => {
          const style = severityStyles[alert.severity]
          const Icon = style.icon

          return (
            <div key={alert.id} className={`rounded-lg border p-4 ${style.className}`}>
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold leading-none">{alert.title}</p>
                  <p className="text-sm opacity-90">{alert.message}</p>
                  <p className="text-xs font-medium opacity-80">{alert.action}</p>
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
