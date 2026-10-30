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
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)} {...props}>
      {Icon && (
        <Icon
          aria-hidden
          className={cn('mb-3 size-6', tone === 'destructive' ? 'text-destructive-soft-foreground' : 'text-muted-foreground')}
          strokeWidth={1.75}
        />
      )}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export { EmptyState }
