import type { Metadata } from 'next'
import { SentryErrorBoundary } from '@/components/sentry-error-boundary'
import './globals.css'

export const metadata: Metadata = {
  title: 'Láyo',
  description: 'Fitness coaching assistant for female endurance athletes',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <SentryErrorBoundary>{children}</SentryErrorBoundary>
      </body>
    </html>
  )
}
