'use client'
import { ErrorBoundary } from '@sentry/nextjs'

export function SentryErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary fallback={<div>Something went wrong.</div>}>
      {children}
    </ErrorBoundary>
  )
}
