import { cn, statusPillClasses } from '@/lib/ui/tokens'

/**
 * Request-status pill (PENDING / APPROVED / REJECTED). Color AND text, so it's
 * legible for color-blind users. Renders the status text as its label.
 */
export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide',
        statusPillClasses(status),
        className
      )}
    >
      {status}
    </span>
  )
}
