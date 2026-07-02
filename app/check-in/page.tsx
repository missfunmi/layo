'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckInFlow } from '@/components/flows/check-in/CheckInFlow'
import { getOrCreateDeviceId } from '@/lib/device'

type PageState =
  | { status: 'loading' }
  | {
      status: 'ready'
      name: string
      hormonalLifeStage: string[]
      previousCheckIn: { plannedWorkout?: string } | null
    }

export default function CheckInPage() {
  const router = useRouter()
  const [state, setState] = useState<PageState>({ status: 'loading' })

  useEffect(() => {
    const deviceId = getOrCreateDeviceId()
    const headers = { 'X-Device-ID': deviceId }

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toLocaleDateString('en-CA')

    Promise.all([
      fetch('/api/users', { headers }).then((r) => r.json()),
      fetch(`/api/check-ins?date=${yesterdayStr}`, { headers }).then((r) => r.json()),
    ]).then(([userData, checkInData]) => {
      setState({
        status: 'ready',
        name: userData.user.name,
        hormonalLifeStage: userData.user.hormonalLifeStage,
        previousCheckIn: checkInData.checkIn
          ? { plannedWorkout: checkInData.checkIn.todaysPlannedWorkout }
          : null,
      })
    })
  }, [])

  if (state.status === 'loading') {
    return <div className="min-h-screen bg-layo-bg" />
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
