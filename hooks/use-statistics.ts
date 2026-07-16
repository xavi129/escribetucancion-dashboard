"use client"

import { useState, useEffect, useCallback } from "react"
import { TimePeriod, StatisticsData, StatisticsState } from "@/lib/statistics-types"
import { getStatistics } from "@/lib/statistics-service"

const DEFAULT_KPI_DATA = {
  totalRevenue: 0,
  completedOrders: 0,
  paidOrders: 0,
  pendingOrders: 0,
  averageOrderValue: 0,
  conversionRate: 0,
}

const DEFAULT_STATISTICS: StatisticsData = {
  kpis: DEFAULT_KPI_DATA,
  previousKpis: null,
  revenueSeries: [],
  statusDistribution: {
    orderStatus: [],
    paymentStatus: [],
  },
  topMetrics: {
    topGenres: [],
    topCountries: [],
    deliveryTypes: [],
  },
}

export function useStatistics(initialPeriod: TimePeriod = "weekly") {
  const [state, setState] = useState<StatisticsState>({
    period: initialPeriod,
    loading: true,
    error: null,
    data: null,
  })

  const fetchData = useCallback(async (period: TimePeriod) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const data = await getStatistics(period)
      setState(prev => ({
        ...prev,
        loading: false,
        data,
        error: null,
      }))
    } catch (error) {
      console.error("Error fetching statistics:", error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Error al cargar estadísticas",
        data: DEFAULT_STATISTICS,
      }))
    }
  }, [])

  const setPeriod = useCallback((period: TimePeriod) => {
    setState(prev => ({ ...prev, period }))
  }, [])

  const retry = useCallback(() => {
    fetchData(state.period)
  }, [fetchData, state.period])

  // Fetch data when period changes
  useEffect(() => {
    fetchData(state.period)
  }, [state.period, fetchData])

  return {
    ...state,
    data: state.data || DEFAULT_STATISTICS,
    setPeriod,
    retry,
  }
}
