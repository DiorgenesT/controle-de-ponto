import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'

const ICONS = {
  default: Info,
  success: CircleCheck,
  destructive: CircleAlert,
} as const

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, variant, open }) => {
        const Icon = ICONS[variant ?? 'default']
        return (
          <Toast key={id} open={open} variant={variant} onOpenChange={(o) => !o && dismiss(id)}>
            <Icon data-toast-icon aria-hidden className="mt-0.5 size-[18px] shrink-0 text-muted-foreground" />
            <div className="grid gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
