import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium transition-colors [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        muted: 'border-transparent bg-muted text-muted-foreground',
        primary: 'border-primary-soft-border bg-primary-soft text-primary-soft-foreground',
        destructive: 'border-destructive-soft-border bg-destructive-soft text-destructive-soft-foreground',
        success: 'border-success-soft-border bg-success-soft text-success-soft-foreground',
        warning: 'border-warning-soft-border bg-warning-soft text-warning-soft-foreground',
        info: 'border-info-soft-border bg-info-soft text-info-soft-foreground',
        special: 'border-special-soft-border bg-special-soft text-special-soft-foreground',
      },
      shape: {
        default: '',
        pill: 'rounded-full px-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      shape: 'default',
    },
  }
)

const dotColors: Record<string, string> = {
  default: 'bg-primary-foreground',
  secondary: 'bg-muted-foreground',
  outline: 'bg-muted-foreground',
  muted: 'bg-muted-foreground',
  primary: 'bg-primary',
  destructive: 'bg-destructive',
  success: 'bg-success',
  warning: 'bg-warning',
  info: 'bg-info',
  special: 'bg-special',
}

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Renders a small status dot before the label. */
  dot?: boolean
}

function Badge({ className, variant, shape, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, shape }), className)} {...props}>
      {dot && <span aria-hidden className={cn('size-1.5 rounded-full', dotColors[variant ?? 'default'])} />}
      {children}
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- shadcn pattern: variants shared with other components
export { Badge, badgeVariants }
