import { useState, useCallback } from 'react'

interface ToastOptions {
  title?: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
  duration?: number
}

interface ToastState extends ToastOptions {
  id: string
  open: boolean
}

const listeners: Array<(toasts: ToastState[]) => void> = []
let toasts: ToastState[] = []

function notify(toastsState: ToastState[]) {
  toasts = toastsState
  listeners.forEach((l) => l(toasts))
}

export function toast(options: ToastOptions) {
  const id = crypto.randomUUID()
  const newToast: ToastState = { ...options, id, open: true }
  notify([...toasts, newToast])

  setTimeout(() => {
    notify(toasts.map((t) => (t.id === id ? { ...t, open: false } : t)))
    setTimeout(() => {
      notify(toasts.filter((t) => t.id !== id))
    }, 300)
  }, options.duration ?? 4000)

  return id
}

export function useToast() {
  const [state, setState] = useState<ToastState[]>(toasts)

  const subscribe = useCallback(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) listeners.splice(index, 1)
    }
  }, [])

  useState(subscribe)

  return { toasts: state, toast }
}
