// Statistics Utility Functions
// Requirements: 3.2, 3.3, 3.4

import { TimePeriod, DateRange } from './statistics-types'

/**
 * Get the date range for a given period
 * - Daily: 00:00:00 to 23:59:59 of reference date
 * - Weekly: Monday 00:00:00 to Sunday 23:59:59 of reference week
 * - Monthly: 1st 00:00:00 to last day 23:59:59 of reference month
 */
export function getDateRange(period: TimePeriod, referenceDate: Date = new Date()): DateRange {
  const ref = new Date(referenceDate)
  
  switch (period) {
    case 'daily': {
      const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0)
      const end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999)
      return { start, end }
    }
    
    case 'weekly': {
      // Get Monday of current week (Monday = 1, Sunday = 0)
      const dayOfWeek = ref.getDay()
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      
      const monday = new Date(ref)
      monday.setDate(ref.getDate() + diffToMonday)
      monday.setHours(0, 0, 0, 0)
      
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      sunday.setHours(23, 59, 59, 999)
      
      return { start: monday, end: sunday }
    }
    
    case 'monthly': {
      const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0)
      const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999)
      return { start, end }
    }
  }
}

/**
 * Get the previous equivalent date range for comparison
 * - Daily: Previous day
 * - Weekly: Previous week (Monday to Sunday)
 * - Monthly: Previous month
 */
export function getPreviousDateRange(period: TimePeriod, referenceDate: Date = new Date()): DateRange {
  const ref = new Date(referenceDate)
  
  switch (period) {
    case 'daily': {
      const previousDay = new Date(ref)
      previousDay.setDate(ref.getDate() - 1)
      return getDateRange('daily', previousDay)
    }
    
    case 'weekly': {
      const previousWeek = new Date(ref)
      previousWeek.setDate(ref.getDate() - 7)
      return getDateRange('weekly', previousWeek)
    }
    
    case 'monthly': {
      const previousMonth = new Date(ref.getFullYear(), ref.getMonth() - 1, 1)
      return getDateRange('monthly', previousMonth)
    }
  }
}

/**
 * Calculate percentage change between two values
 * Returns null if previous value is 0 (to avoid division by zero)
 */
export function calculatePercentageChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : null
  }
  return ((current - previous) / previous) * 100
}

/**
 * Format date to ISO string for Supabase queries
 */
export function toISOString(date: Date): string {
  return date.toISOString()
}

/**
 * Get label for a date based on period type
 */
export function getDateLabel(date: Date, period: TimePeriod): string {
  switch (period) {
    case 'daily':
      return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
    case 'weekly':
      return date.toLocaleDateString('es-MX', { weekday: 'short' })
    case 'monthly':
      return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  }
}

/**
 * Get all time slots for a period (for filling empty data points)
 */
export function getTimeSlots(period: TimePeriod, dateRange: DateRange): Date[] {
  const slots: Date[] = []
  const current = new Date(dateRange.start)
  
  switch (period) {
    case 'daily':
      // 24 hours
      for (let hour = 0; hour < 24; hour++) {
        const slot = new Date(current)
        slot.setHours(hour, 0, 0, 0)
        slots.push(slot)
      }
      break
      
    case 'weekly':
      // 7 days
      for (let day = 0; day < 7; day++) {
        const slot = new Date(current)
        slot.setDate(current.getDate() + day)
        slot.setHours(0, 0, 0, 0)
        slots.push(slot)
      }
      break
      
    case 'monthly':
      // All days in month
      const endDate = dateRange.end.getDate()
      for (let day = 1; day <= endDate; day++) {
        const slot = new Date(current.getFullYear(), current.getMonth(), day, 0, 0, 0, 0)
        slots.push(slot)
      }
      break
  }
  
  return slots
}

/**
 * Group a date into its time slot key based on period
 */
export function getTimeSlotKey(date: Date, period: TimePeriod): string {
  switch (period) {
    case 'daily':
      return `${date.getHours()}`
    case 'weekly':
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    case 'monthly':
      return `${date.getDate()}`
  }
}
