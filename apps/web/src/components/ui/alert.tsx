import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative flex w-full gap-3 rounded-lg border bg-card px-4 py-3 text-sm text-foreground [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0',
  {
    variants: {
      // Neutral surface; only the icon (and text, for errors) carries the tone.
      variant: {
        default: '[&>svg]:text-muted-foreground',
        info: '[&>svg]:text-muted-foreground',
        success: '[&>svg]:text-success-soft-foreground',
        warning: '[&>svg]:text-warning-soft-foreground',
        destructive: 'border-destructive-soft-border text-destructive-soft-foreground',
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
  return <div className={cn('text-[13px] leading-relaxed', className)} {...props} />
}

export { Alert, AlertTitle, AlertDescription }
