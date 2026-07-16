'use client'

import { useWindowStatus } from '@/hooks/use-window-status'

interface WindowStatusIndicatorProps {
  lastIncomingAt: string | null
}

export default function WindowStatusIndicator({ lastIncomingAt }: WindowStatusIndicatorProps) {
  const status = useWindowStatus(lastIncomingAt)

  return (
    <div className={`flex items-center gap-2 text-sm ${status.isOpen ? 'text-green-400' : 'text-red-400'}`}>
      <div className={`w-2 h-2 rounded-full ${status.isOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
      {status.isOpen ? (
        <span>Ventana activa: {status.remainingFormatted}</span>
      ) : (
        <span>{status.remainingFormatted}</span>
      )}
    </div>
  )
}
