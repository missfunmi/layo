'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckInFlow } from '@/components/flows/check-in/CheckInFlow'
import { getDeviceId } from '@/lib/device'
import { getRecommendationHeading, type RecommendationType } from '@/lib/recommendation'
import { Button } from '@/components/ui/Button'

type PageState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready'
      name: string
      hormonalLifeStage: string[]
      previousCheckIn: { plannedWorkout?: string; recommendationHeading?: string } | null
    }

export default function CheckInPage() {
  const router = useRouter()
  const [state, setState] = useState<PageState>({ status: 'loading' })
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    setState({ status: 'loading' })
    const deviceId = getDeviceId()
    if (!deviceId) {
      router.push('/onboarding')
      return
    }
    const headers = { 'X-Device-ID': deviceId }

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toLocaleDateString('en-CA')

    Promise.all([
      fetch('/api/users', { headers }),
      fetch(`/api/check-ins?date=${yesterdayStr}`, { headers }),
      fetch(`/api/recommendations?date=${yesterdayStr}`, { headers }),
    ])
      .then(async ([userRes, checkInRes, recommendationRes]) => {
        if (userRes.status === 401 || checkInRes.status === 401 || recommendationRes.status === 401) {
          router.push('/onboarding')
          return
        }
        if (!userRes.ok || !checkInRes.ok || !recommendationRes.ok) {
          setState({ status: 'error' })
          return
        }

        const [userData, checkInData, recommendationData] = await Promise.all([
          userRes.json(),
          checkInRes.json(),
          recommendationRes.json(),
        ])
        const recommendation = recommendationData.recommendation as {
          recommendationType: RecommendationType
          modificationDetail?: string | null
        } | null

        setState({
          status: 'ready',
          name: userData.user.name,
          hormonalLifeStage: userData.user.hormonalLifeStage,
          previousCheckIn: checkInData.checkIn
            ? {
                plannedWorkout: checkInData.checkIn.todaysPlannedWorkout,
                recommendationHeading: recommendation
                  ? getRecommendationHeading(recommendation.recommendationType, recommendation.modificationDetail)
                  : undefined,
              }
            : null,
        })
      })
      .catch(() => {
        setState({ status: 'error' })
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
