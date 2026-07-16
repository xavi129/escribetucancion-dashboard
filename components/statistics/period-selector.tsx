"use client"

import { Button } from "@/components/ui/button"
import { TimePeriod } from "@/lib/statistics-types"
import { Calendar, CalendarDays, CalendarRange } from "lucide-react"

interface PeriodSelectorProps {
  selected: TimePeriod
  onChange: (period: TimePeriod) => void
}

const periods: { value: TimePeriod; label: string; icon: React.ReactNode }[] = [
  { value: "daily", label: "Hoy", icon: <Calendar className="h-4 w-4" /> },
  { value: "weekly", label: "Esta Semana", icon: <CalendarDays className="h-4 w-4" /> },
  { value: "monthly", label: "Este Mes", icon: <CalendarRange className="h-4 w-4" /> },
]

export default function PeriodSelector({ selected, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex p-1 gap-1 bg-white/5 backdrop-blur-md rounded-xl border border-white/10">
      {periods.map((period) => {
        const isSelected = selected === period.value
        return (
          <Button
            key={period.value}
            variant="ghost"
            size="sm"
            onClick={() => onChange(period.value)}
            className={`flex items-center gap-2 rounded-lg transition-all duration-300 relative overflow-hidden ${isSelected
                ? "text-white bg-white/10 shadow-lg"
                : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
          >
            {isSelected && (
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 opacity-100" />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {period.icon}
              {period.label}
            </span>
          </Button>
        )
      })}
    </div>
  )
}
