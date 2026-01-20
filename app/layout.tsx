import type { Metadata } from 'next'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}

