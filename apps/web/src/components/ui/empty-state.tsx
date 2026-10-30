import * as React from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: React.ElementType
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  tone?: 'default' | 'destructive'
}

/** Empty / error placeholder for lists and cards. */
function EmptyState({ icon: Icon, title, description, action, tone = 'default', className, ...props }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)} {...props}>
      {Icon && (
        <div
          className={cn(
            'mb-4 flex size-12 items-center justify-center rounded-xl border [&_svg]:size-5',
            tone === 'destructive'
              ? 'border-destructive-soft-border bg-destructive-soft text-destructive-soft-foreground'
              : 'bg-muted text-muted-foreground'
          )}
        >
          <Icon aria-hidden />
        </div>
      )}
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export { EmptyState }
