import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'

export const metadata: Metadata = {
  title: 'wetrack',
  description: 'Simple and powerful time tracking',
  icons: {
    icon: '/wellflex_logo.jpg',
    shortcut: '/wellflex_logo.jpg',
    apple: '/wellflex_logo.jpg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  )
}

