'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'primary' | 'danger'
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/**
 * Provides a promise-based `confirm()` — a styled, accessible replacement for
 * the native `window.confirm`. Resolves true on confirm, false on cancel /
 * Escape / backdrop. Wrap the app once; call via `useConfirm()`.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result)
    resolver.current = null
    setOptions(null)
  }, [])

  const value = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={!!options}
        onClose={() => settle(false)}
        label={options?.title || 'Confirm action'}
        className="bg-white rounded-card-lg shadow-lift w-full max-w-md p-8"
      >
        {options && (
          <>
            <h2 className="text-xl font-black text-slate-900 mb-2">{options.title || 'Are you sure?'}</h2>
            <p className="text-slate-500 font-bold text-sm mb-8">{options.message}</p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => settle(false)} className="flex-1">
                {options.cancelLabel || 'Cancel'}
              </Button>
              <Button
                variant={options.variant === 'danger' ? 'danger' : 'primary'}
                onClick={() => settle(true)}
                className="flex-1"
              >
                {options.confirmLabel || 'Confirm'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider')
  return ctx
}
