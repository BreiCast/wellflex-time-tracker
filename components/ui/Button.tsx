import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/ui/tokens'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 font-black rounded-control transition-all transform active:scale-95 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'disabled:opacity-50 disabled:pointer-events-none disabled:grayscale'

const variantClasses: Record<Variant, string> = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-200 focus-visible:ring-primary-500',
  secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:ring-slate-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-200 focus-visible:ring-rose-500',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400',
}

const sizeClasses: Record<Size, string> = {
  sm: 'text-xs px-4 py-2',
  md: 'text-sm px-5 py-3',
  lg: 'text-lg px-6 py-4',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Show a spinner and disable the button while an action is in flight. */
  loading?: boolean
}

/**
 * Standard button with variants, sizes, a loading state, and a built-in
 * `focus-visible` ring (the app had none). Use instead of hand-rolled button
 * classes.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(base, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
})
