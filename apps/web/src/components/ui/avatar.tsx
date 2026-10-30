import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn } from '@/lib/utils'

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn('relative flex size-9 shrink-0 overflow-hidden rounded-full', className)}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn('aspect-square size-full object-cover', className)} {...props} />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn('flex size-full items-center justify-center rounded-[inherit] bg-muted text-xs font-semibold', className)}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

// Soft tints, each pair ≥ 4.5:1 in both themes.
const TINTS = [
  'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300',
]

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'
  )
}

function tintFor(name: string) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return TINTS[Math.abs(hash) % TINTS.length]
}

interface UserAvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  name: string
  src?: string
}

/** Avatar with deterministic colored initials derived from the name. */
function UserAvatar({ name, src, className, ...props }: UserAvatarProps) {
  return (
    <Avatar className={className} {...props}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback className={tintFor(name)}>{getInitials(name)}</AvatarFallback>
    </Avatar>
  )
}

export { Avatar, AvatarImage, AvatarFallback, UserAvatar }
