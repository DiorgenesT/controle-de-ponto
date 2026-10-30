import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type NativeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

/**
 * Styled native <select>. Works directly with react-hook-form's register() and is the
 * better choice inside dense tables (e.g. tipo de dia no lançamento de ponto).
 */
const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(({ className, children, ...props }, ref) => (
  <div className="relative w-full">
    <select
      ref={ref}
      className={cn(
        'h-9 w-full cursor-pointer appearance-none rounded-md border border-input bg-card pl-3 pr-8 text-sm text-foreground outline-none transition-[color,border-color,box-shadow]',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20',
        'aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/20 dark:[&>option]:bg-popover',
        className
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
  </div>
))
NativeSelect.displayName = 'NativeSelect'

export { NativeSelect }
