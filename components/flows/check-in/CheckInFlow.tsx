'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

type Step = 'landing'

interface CheckInFlowProps {
  name: string
}

function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function CheckInFlow({ name }: CheckInFlowProps) {
  const [step, setStep] = useState<Step>('landing')
  const greeting = getGreeting(new Date().getHours())

  if (step === 'landing') {
    return (
      <div className="flex flex-col min-h-screen bg-layo-bg">
        <div className="px-6 pt-[22px] flex items-center" style={{ minHeight: '52px' }}>
          <div className="font-display font-bold text-[#0F6E56] text-[21px] tracking-[-0.5px]">
            láyo
          </div>
        </div>
        <div className="flex flex-col flex-1 px-6 pb-7 justify-between">
          <div>
            <div className="font-sans font-medium text-[12px] tracking-[0.08em] uppercase text-[#B4B2A9] mb-[14px]">
              {greeting}
            </div>
            <h1 className="font-display font-bold text-[#2C2C2A] text-[28px] leading-[1.2] mb-[14px]">
              Ready for today, {name}?
            </h1>
            <p className="font-sans text-[#888780] text-[13px] leading-[1.6]">
              It takes about two minutes. Láyo will take it from there.
            </p>
          </div>
          <Button onClick={() => setStep('landing')}>
            Start today&apos;s check-in
          </Button>
        </div>
      </div>
    )
  }

  return null
}
