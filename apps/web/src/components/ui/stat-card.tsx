import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

const iconTone = cva('flex size-10 shrink-0 items-center justify-center rounded-lg border [&_svg]:size-5', {
  variants: {
    tone: {
      default: 'border-border bg-muted text-muted-foreground',
      primary: 'border-primary-soft-border bg-primary-soft text-primary-soft-foreground',
      success: 'border-success-soft-border bg-success-soft text-success-soft-foreground',
      warning: 'border-warning-soft-border bg-warning-soft text-warning-soft-foreground',
      destructive: 'border-destructive-soft-border bg-destructive-soft text-destructive-soft-foreground',
      info: 'border-info-soft-border bg-info-soft text-info-soft-foreground',
      special: 'border-special-soft-border bg-special-soft text-special-soft-foreground',
    },
  },
  defaultVariants: { tone: 'default' },
})

const valueTone: Record<string, string> = {
  default: 'text-foreground',
  primary: 'text-primary-soft-foreground',
  success: 'text-success-soft-foreground',
  warning: 'text-warning-soft-foreground',
  destructive: 'text-destructive-soft-foreground',
  info: 'text-info-soft-foreground',
  special: 'text-special-soft-foreground',
}

export interface StatCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof iconTone> {
  label: React.ReactNode
  value: React.ReactNode
  icon?: React.ElementType
  /** Secondary line under the value (e.g. "+2 vs mês anterior"). */
  hint?: React.ReactNode
  loading?: boolean
  /** Colors the value with the tone too (default: only the icon is tinted). */
  emphasize?: boolean
}

/** KPI tile: label, big tabular value, optional icon and hint. */
function StatCard({ label, value, icon: Icon, hint, tone, loading, emphasize, className, ...props }: StatCardProps) {
  return (
    <div className={cn('rounded-xl border bg-card p-4 shadow-xs sm:p-5', className)} {...props}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="truncate text-[12px] font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <p
              className={cn(
                'text-2xl font-semibold leading-none tracking-tight tabular-nums',
                emphasize ? valueTone[tone ?? 'default'] : 'text-foreground'
              )}
            >
              {value}
            </p>
          )}
          {hint && !loading && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className={iconTone({ tone })}>
            <Icon aria-hidden />
          </div>
        )}
      </div>
    </div>
  )
}

export { StatCard }
