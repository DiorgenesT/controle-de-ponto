import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

interface FormFieldProps {
  label: React.ReactNode
  htmlFor?: string
  error?: string
  hint?: React.ReactNode
  required?: boolean
  className?: string
  children: React.ReactNode
}

/** Label + control + hint/error, with consistent spacing. */
function FormField({ label, htmlFor, error, hint, required, className, children }: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive-soft-foreground">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export { FormField }
