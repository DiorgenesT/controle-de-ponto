import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Badges are neutral labels. Color is reserved for states that carry meaning
// (destructive = falta/erro, warning = pendência, success = positivo) and shows
// only in the text/dot, never as a tinted fill.
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-1.5 py-px text-xs font-medium [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        muted: 'border-transparent bg-muted text-muted-foreground',
        primary: 'border-border text-foreground',
        destructive: 'border-border text-destructive-soft-foreground',
        success: 'border-border text-success-soft-foreground',
        warning: 'border-border text-warning-soft-foreground',
        info: 'border-border text-foreground',
        special: 'border-border text-foreground',
      },
      shape: {
        default: '',
        pill: '',
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
  primary: 'bg-muted-foreground',
  destructive: 'bg-destructive',
  success: 'bg-success',
  warning: 'bg-warning',
  info: 'bg-muted-foreground',
  special: 'bg-muted-foreground',
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
