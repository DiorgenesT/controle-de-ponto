import { useEffect, useState } from 'react'

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

const listeners = new Set<(toasts: ToastState[]) => void>()
let toasts: ToastState[] = []

function notify(next: ToastState[]) {
  toasts = next
  listeners.forEach((l) => l(toasts))
}

export function toast(options: ToastOptions) {
  const id = crypto.randomUUID()
  notify([...toasts, { ...options, id, open: true }])

  setTimeout(() => dismissToast(id), options.duration ?? 4000)

  return id
}

export function dismissToast(id: string) {
  notify(toasts.map((t) => (t.id === id ? { ...t, open: false } : t)))
  setTimeout(() => notify(toasts.filter((t) => t.id !== id)), 300)
}

export function useToast() {
  const [state, setState] = useState<ToastState[]>(toasts)

  useEffect(() => {
    listeners.add(setState)
    return () => {
      listeners.delete(setState)
    }
  }, [])

  return { toasts: state, toast, dismiss: dismissToast }
}
