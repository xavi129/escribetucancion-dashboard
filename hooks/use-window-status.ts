'use client'

import { useState, useEffect } from 'react'

export interface WindowStatus {
  isOpen: boolean
  expiresAt: Date | null
  remainingMs: number
  remainingFormatted: string
}

/**
 * Calculate the 24-hour window status
 */
export function calculateWindowStatus(lastIncomingAt: string | null): WindowStatus {
  if (!lastIncomingAt) {
    return {
      isOpen: false,
      expiresAt: null,
      remainingMs: 0,
      remainingFormatted: 'Sin mensajes',
    }
  }

  const lastMessage = new Date(lastIncomingAt)
  const expiresAt = new Date(lastMessage.getTime() + 24 * 60 * 60 * 1000)
  const remainingMs = expiresAt.getTime() - Date.now()

  if (remainingMs <= 0) {
    return {
      isOpen: false,
      expiresAt,
      remainingMs: 0,
      remainingFormatted: 'Ventana cerrada',
    }
  }

  const hours = Math.floor(remainingMs / (1000 * 60 * 60))
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000)

  return {
    isOpen: true,
    expiresAt,
    remainingMs,
    remainingFormatted: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
  }
}

/**
 * Hook for real-time window countdown
 */
export function useWindowStatus(lastIncomingAt: string | null): WindowStatus {
  const [status, setStatus] = useState<WindowStatus>(() =>
    calculateWindowStatus(lastIncomingAt)
  )

  useEffect(() => {
    if (!lastIncomingAt) {
      setStatus(calculateWindowStatus(null))
      return
    }

    // Update immediately
    setStatus(calculateWindowStatus(lastIncomingAt))

    // Update every second
    const interval = setInterval(() => {
      const newStatus = calculateWindowStatus(lastIncomingAt)
      setStatus(newStatus)
      
      // Stop updating if window is closed
      if (!newStatus.isOpen) {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [lastIncomingAt])

  return status
}
