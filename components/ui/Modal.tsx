'use client'

import { ReactNode, useEffect, useRef } from 'react'
import { cn } from '@/lib/ui/tokens'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  open: boolean
  onClose: () => void
  /** Accessible name for the dialog (screen readers). */
  label: string
  children: ReactNode
  /** Classes for the dialog panel (width, rounding, layout, etc.). */
  className?: string
  /** When false, Escape and backdrop-click do not close (e.g. mid-action). */
  dismissible?: boolean
}

/**
 * Accessible modal shell: role="dialog" + aria-modal, Escape to close, focus
 * trap with focus restore on close, backdrop-click to dismiss, and body scroll
 * lock. The caller supplies the full panel content (including any header) and
 * the panel's `className`. Renders nothing when `open` is false.
 */
export function Modal({ open, onClose, label, children, className, dismissible = true }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement | null

    const panel = panelRef.current
    const focusables = panel?.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (focusables && focusables.length > 0) focusables[0].focus()
    else panel?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab' && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (items.length === 0) {
          e.preventDefault()
          return
        }
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = prevOverflow
      previouslyFocused.current?.focus?.()
    }
  }, [open, onClose, dismissible])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn('outline-none', className)}
      >
        {children}
      </div>
    </div>
  )
}
