'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckInFlow } from '@/components/flows/check-in/CheckInFlow'
import { getOrCreateDeviceId } from '@/lib/device'
import { Button } from '@/components/ui/Button'

type PageState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready'
      name: string
      hormonalLifeStage: string[]
      previousCheckIn: { plannedWorkout?: string } | null
    }

export default function CheckInPage() {
  const router = useRouter()
  const [state, setState] = useState<PageState>({ status: 'loading' })
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    setState({ status: 'loading' })
    const deviceId = getOrCreateDeviceId()
    const headers = { 'X-Device-ID': deviceId }

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toLocaleDateString('en-CA')

    Promise.all([
      fetch('/api/users', { headers }).then((r) => r.json()),
      fetch(`/api/check-ins?date=${yesterdayStr}`, { headers }).then((r) => r.json()),
    ])
      .then(([userData, checkInData]) => {
        setState({
          status: 'ready',
          name: userData.user.name,
          hormonalLifeStage: userData.user.hormonalLifeStage,
          previousCheckIn: checkInData.checkIn
            ? { plannedWorkout: checkInData.checkIn.todaysPlannedWorkout }
            : null,
        })
      })
      .catch(() => {
        setState({ status: 'error' })
      })
  }, [retryCount])

  if (state.status === 'loading') {
    return <div className="min-h-dvh bg-layo-bg" />
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-dvh bg-[#F1EFE8] flex flex-col items-center justify-center px-6 gap-4">
        <h1 className="font-display font-bold text-[24px] text-[#D85A30] text-center">
          Something went wrong
        </h1>
        <div className="w-full max-w-[343px]">
          <Button onClick={() => setRetryCount((c) => c + 1)}>Try again</Button>
        </div>
      </div>
    )
  }

  return (
    <CheckInFlow
      name={state.name}
      hormonalLifeStage={state.hormonalLifeStage}
      previousCheckIn={state.previousCheckIn}
      onSuccess={() => router.push('/recommendation')}
      onClose={() => router.push('/')}
    />
  )
}
