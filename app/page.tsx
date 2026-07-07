'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getDeviceId } from '@/lib/device'
import { Button } from '@/components/ui/Button'

type PageState = 'loading' | 'error'

export default function Home() {
  const router = useRouter()
  const [state, setState] = useState<PageState>('loading')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    setState('loading')
    if (new URLSearchParams(window.location.search).get('force') === 'true') {
      router.push('/onboarding')
      return
    }
    const deviceId = getDeviceId()
    if (!deviceId) {
      router.push('/onboarding')
      return
    }

    const today = new Date().toLocaleDateString('en-CA')

    fetch(`/api/check-ins?date=${today}`, {
      headers: { 'X-Device-ID': deviceId },
    })
      .then(async (r) => {
        if (r.status === 401) {
          router.push('/onboarding')
          return
        }
        if (!r.ok) {
          setState('error')
          return
        }
        const data = await r.json()
        if (data.checkIn) {
          router.push('/recommendation')
        } else {
          router.push('/check-in')
        }
      })
      .catch(() => {
        setState('error')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount])

  if (state === 'error') {
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
    <div className="min-h-dvh bg-[#F1EFE8] flex items-center justify-center">
      <div className="font-display font-bold text-[52px] text-[#0F6E56] tracking-[-0.5px]">
        láyo
      </div>
    </div>
  )
}
