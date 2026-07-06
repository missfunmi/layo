'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RecommendationView } from '@/components/flows/recommendation/RecommendationView'
import { getOrCreateDeviceId } from '@/lib/device'
import { Button } from '@/components/ui/Button'

type RecommendationType = 'as_written' | 'modify' | 'rest'

interface RecommendationData {
  recommendationType: RecommendationType
  modificationDetail?: string | null
  rationale: string
}

interface CheckInData {
  sleepSatisfaction: number
  feelScore: number
  cycleDay?: number | null
  todaysPlannedWorkout: string
  yesterdayWorkoutType?: 'planned' | 'suggested' | 'other' | null
  stressors?: string | null
}

type PageState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; recommendation: RecommendationData; checkIn: CheckInData }

export default function RecommendationPage() {
  const router = useRouter()
  const [state, setState] = useState<PageState>({ status: 'loading' })
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    setState({ status: 'loading' })
    const deviceId = getOrCreateDeviceId()
    const headers = { 'X-Device-ID': deviceId }
    const today = new Date().toLocaleDateString('en-CA')

    Promise.all([
      fetch(`/api/recommendations?date=${today}`, { headers }).then((r) => r.json()),
      fetch(`/api/check-ins?date=${today}`, { headers }).then((r) => r.json()),
    ])
      .then(([recData, checkInData]) => {
        if (!recData.recommendation) {
          router.push('/check-in')
          return
        }
        setState({
          status: 'ready',
          recommendation: recData.recommendation,
          checkIn: checkInData.checkIn,
        })
      })
      .catch(() => {
        setState({ status: 'error' })
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount])

  if (state.status === 'loading') {
    return (
      <div className="min-h-dvh bg-[#F1EFE8] flex items-center justify-center">
        <div className="font-display font-bold text-[52px] text-[#0F6E56] tracking-[-0.5px]">
          láyo
        </div>
      </div>
    )
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
    <RecommendationView
      recommendation={state.recommendation}
      checkIn={state.checkIn}
      onRedo={() => router.push('/check-in')}
    />
  )
}
