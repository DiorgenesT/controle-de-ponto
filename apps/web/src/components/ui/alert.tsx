import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative flex w-full gap-3 rounded-xl border px-4 py-3 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-card text-foreground [&>svg]:text-muted-foreground',
        info: 'border-info-soft-border bg-info-soft text-info-soft-foreground',
        success: 'border-success-soft-border bg-success-soft text-success-soft-foreground',
        warning: 'border-warning-soft-border bg-warning-soft text-warning-soft-foreground',
        destructive: 'border-destructive-soft-border bg-destructive-soft text-destructive-soft-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
))
Alert.displayName = 'Alert'

function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('font-semibold leading-tight', className)} {...props} />
}

function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-[13px] leading-relaxed opacity-95', className)} {...props} />
}

export { Alert, AlertTitle, AlertDescription }
