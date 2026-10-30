import * as React from 'react'
import { cn } from '@/lib/utils'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground transition-[color,border-color,box-shadow] outline-none',
      'placeholder:text-muted-foreground/80',
      'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20',
      'aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20',
      'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 dark:bg-input/20',
      className
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

export { Textarea }
