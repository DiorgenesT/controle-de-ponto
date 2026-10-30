import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

interface MonthSwitcherProps {
  year: number
  /** 1–12 */
  month: number
  onPrev: () => void
  onNext: () => void
  disablePrev?: boolean
  disableNext?: boolean
  className?: string
}

/** Segmented "‹ Outubro 2026 ›" control for competência navigation. */
function MonthSwitcher({ year, month, onPrev, onNext, disablePrev, disableNext, className }: MonthSwitcherProps) {
  const btn =
    'flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35 cursor-pointer'
  return (
    <div className={cn('inline-flex items-center overflow-hidden rounded-lg border bg-card shadow-xs', className)}>
      <button type="button" onClick={onPrev} disabled={disablePrev} className={btn} aria-label="Mês anterior">
        <ChevronLeft className="size-4" />
      </button>
      <span
        aria-live="polite"
        className="min-w-[9.5rem] border-x px-3 text-center text-sm font-semibold leading-9 tabular-nums text-foreground"
      >
        {MONTHS[month - 1]} {year}
      </span>
      <button type="button" onClick={onNext} disabled={disableNext} className={btn} aria-label="Próximo mês">
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}

export { MonthSwitcher, MONTHS }
