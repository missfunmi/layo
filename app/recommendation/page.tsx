'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RecommendationView } from '@/components/flows/recommendation/RecommendationView'
import { getOrCreateDeviceId } from '@/lib/device'

type RecommendationType = 'as_written' | 'modify' | 'rest'

interface RecommendationData {
  recommendationType: RecommendationType
  modificationDetail?: string | null
  rationale: string
}

interface CheckInData {
  sleepScore: number
  feelScore: number
  cycleDay?: number | null
  todaysPlannedWorkout: string
  yesterdayWorkoutType?: 'planned' | 'suggested' | 'other' | null
  stressors?: string | null
}

type PageState =
  | { status: 'loading' }
  | { status: 'ready'; recommendation: RecommendationData; checkIn: CheckInData }

export default function RecommendationPage() {
  const router = useRouter()
  const [state, setState] = useState<PageState>({ status: 'loading' })

  useEffect(() => {
    const deviceId = getOrCreateDeviceId()
    const headers = { 'X-Device-ID': deviceId }
    const today = new Date().toLocaleDateString('en-CA')

    Promise.all([
      fetch(`/api/recommendations?date=${today}`, { headers }).then((r) => r.json()),
      fetch(`/api/check-ins?date=${today}`, { headers }).then((r) => r.json()),
    ]).then(([recData, checkInData]) => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-[#F1EFE8] flex items-center justify-center">
        <div className="font-display font-bold text-[52px] text-[#0F6E56] tracking-[-0.5px]">
          láyo
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
