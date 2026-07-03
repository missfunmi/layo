'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getDeviceId } from '@/lib/device'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const deviceId = getDeviceId()
    if (!deviceId) {
      router.push('/onboarding')
      return
    }

    const today = new Date().toLocaleDateString('en-CA')

    fetch(`/api/check-ins?date=${today}`, {
      headers: { 'X-Device-ID': deviceId },
    }).then(async (r) => {
      if (r.status === 401) {
        router.push('/onboarding')
        return
      }
      const data = await r.json()
      if (data.checkIn) {
        router.push('/recommendation')
      } else {
        router.push('/check-in')
      }
    })
  }, [router])

  return (
    <div className="min-h-screen bg-[#F1EFE8] flex items-center justify-center">
      <div className="font-display font-bold text-[52px] text-[#0F6E56] tracking-[-0.5px]">
        láyo
      </div>
    </div>
  )
}
