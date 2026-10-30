import { cn } from '@/lib/utils'

/** Flat brand mark: "AM" monogram on solid primary. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'flex size-8 shrink-0 select-none items-center justify-center rounded-md bg-primary text-[13px] font-bold tracking-tight text-primary-foreground',
        className
      )}
    >
      AM
    </div>
  )
}
