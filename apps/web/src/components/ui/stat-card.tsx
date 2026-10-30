import * as React from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

type Tone = 'default' | 'success' | 'destructive'

// Only the number is colored, and only when the sign carries meaning.
const valueTone: Record<Tone, string> = {
  default: 'text-foreground',
  success: 'text-success-soft-foreground',
  destructive: 'text-destructive-soft-foreground',
}

/** Bordered strip of KPI cells separated by 1px rules (no floating cards). */
function StatGroup({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn('grid gap-px overflow-hidden rounded-lg border bg-border', className)}
      {...props}
    />
  )
}

export interface StatCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  label: React.ReactNode
  value: React.ReactNode
  /** Secondary line under the value (e.g. "Anterior −06:53"). */
  hint?: React.ReactNode
  tone?: Tone
  loading?: boolean
}

/** Typographic minus (U+2212) for display: same width as "+", reads better than a hyphen. */
function displayValue(value: React.ReactNode) {
  return typeof value === 'string' ? value.replace(/^-/, '\u2212') : value
}

/** KPI cell: small label, large tabular value, optional hint. Meant to live inside StatGroup. */
function StatCard({ label, value, hint, tone = 'default', loading, className, ...props }: StatCardProps) {
  return (
    <div className={cn('min-w-0 bg-card px-4 py-3', className)} {...props}>
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-1.5 h-6 w-16" />
      ) : (
        <p className={cn('mt-1 text-xl font-semibold leading-tight tabular-nums', valueTone[tone])}>{displayValue(value)}</p>
      )}
      {hint && !loading && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export { StatGroup, StatCard }
