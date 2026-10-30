import * as React from 'react'
import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground transition-[color,border-color,box-shadow] outline-none',
        'placeholder:text-muted-foreground/80 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20',
        'aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60',
        'dark:bg-input/20 [&::-webkit-calendar-picker-indicator]:cursor-pointer dark:[&::-webkit-calendar-picker-indicator]:invert',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
