import { Gauge } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Brand square: speedometer glyph on the primary orange. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 text-white shadow-sm ring-1 ring-inset ring-white/15',
        className
      )}
    >
      <Gauge className="size-[18px]" strokeWidth={2.25} />
    </div>
  )
}
