import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Inter } from 'next/font/google'
import { SentryErrorBoundary } from '@/components/sentry-error-boundary'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  weight: ['700'],
  subsets: ['latin'],
  variable: '--font-space-grotesk',
})

const inter = Inter({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Láyo',
  description: 'Fitness coaching assistant for female endurance athletes',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"
        />
      </head>
      <body className={`${spaceGrotesk.variable} ${inter.variable} bg-layo-bg`}>
        <SentryErrorBoundary>{children}</SentryErrorBoundary>
      </body>
    </html>
  )
}
