import { HTMLAttributes } from 'react'
import { cn } from '@/lib/ui/tokens'

/**
 * Standard surface card: white, large radius, subtle border + elevation.
 * Replaces the many hand-rolled `bg-white rounded-[3rem] shadow-[…] border`
 * combinations. Pass `className` to tune padding/width per use.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-white rounded-card-lg border border-slate-100 shadow-card', className)}
      {...props}
    />
  )
}
