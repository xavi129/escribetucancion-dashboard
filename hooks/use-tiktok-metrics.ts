"use client"

import { useState, useEffect, useCallback } from "react"
import { TimePeriod } from "@/lib/statistics-types"
import { TikTokMetrics, ROIData } from "@/lib/tiktok-types"

interface TikTokMetricsState {
  loading: boolean
  error: string | null
  configured: boolean
  metrics: TikTokMetrics | null
  previousMetrics: TikTokMetrics | null
  roi: ROIData | null
}

const DEFAULT_STATE: TikTokMetricsState = {
  loading: true,
  error: null,
  configured: true,
  metrics: null,
  previousMetrics: null,
  roi: null,
}

export function useTikTokMetrics(period: TimePeriod) {
  const [state, setState] = useState<TikTokMetricsState>(DEFAULT_STATE)

  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch(`/api/tiktok/metrics?period=${period}`)
      const data = await response.json()

      if (!data.success) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: data.error,
          configured: data.configured !== false,
        }))
        return
      }

      setState({
        loading: false,
        error: null,
        configured: true,
        metrics: data.data.metrics,
        previousMetrics: data.data.previousMetrics,
        roi: data.data.roi,
      })
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Error fetching TikTok metrics',
      }))
    }
  }, [period])

  const retry = useCallback(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { ...state, retry }
}
