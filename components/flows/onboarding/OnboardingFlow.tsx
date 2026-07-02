'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/TextInput'
import { BackButton } from '@/components/ui/BackButton'
import { CloseButton } from '@/components/ui/CloseButton'
import { ProgressDots } from '@/components/ui/ProgressDots'

type Step = 'welcome' | 'name' | 'birth_year'

interface OnboardingFlowProps {
  onClose: () => void
  onComplete: () => void
}

export function OnboardingFlow({ onClose, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<Step>('welcome')
  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState('')

  const currentYear = new Date().getFullYear()
  const minYear = currentYear - 100
  const maxYear = currentYear - 13

  const isNameValid = name.length >= 1 && name.length <= 50

  const birthYearNum = parseInt(birthYear, 10)
  const isBirthYearValid =
    /^\d{4}$/.test(birthYear) &&
    birthYearNum >= minYear &&
    birthYearNum <= maxYear

  if (step === 'welcome') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F1EFE8]">
        <div className="text-center px-8 py-10">
          <div
            className="font-[700] text-[#0F6E56] mb-[10px]"
            style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '52px', letterSpacing: '-1.5px' }}
          >
            láyo
          </div>
          <div
            className="text-[#888780] mb-12"
            style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', lineHeight: '1.65' }}
          >
            Your daily training companion,<br />built around how you actually feel.
          </div>
          <div className="w-[180px] mx-auto">
            <Button onClick={() => setStep('name')}>Get started</Button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'name') {
    return (
      <div className="flex flex-col min-h-screen bg-[#F1EFE8]">
        <div className="px-6 pt-[22px] flex items-center justify-between" style={{ minHeight: '52px' }}>
          <div
            className="text-[#0F6E56]"
            style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '21px', letterSpacing: '-0.5px' }}
          >
            láyo
          </div>
        </div>
        <div className="flex flex-col flex-1 px-6 pt-[22px] pb-7">
          <div className="flex items-center gap-[10px] mb-6">
            <div data-testid="progress-dots" className="flex-1">
              <ProgressDots total={5} active={0} />
            </div>
            <CloseButton onClick={onClose} />
          </div>
          <h2
            className="text-[#2C2C2A] mb-2"
            style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '22px', lineHeight: '1.25' }}
          >
            What should we call you?
          </h2>
          <p className="text-[#888780] mb-6" style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', lineHeight: '1.55' }}>
            This is how Láyo will address you.
          </p>
          <TextInput
            value={name}
            onChange={setName}
            placeholder="Your name"
            maxLength={50}
          />
          <Button onClick={() => setStep('birth_year')} disabled={!isNameValid}>
            Continue
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'birth_year') {
    return (
      <div className="flex flex-col min-h-screen bg-[#F1EFE8]">
        <div className="px-6 pt-[22px] flex items-center justify-between" style={{ minHeight: '52px' }}>
          <div
            className="text-[#0F6E56]"
            style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '21px', letterSpacing: '-0.5px' }}
          >
            láyo
          </div>
        </div>
        <div className="flex flex-col flex-1 px-6 pt-[22px] pb-7">
          <div className="flex items-center gap-[10px] mb-6">
            <BackButton onClick={() => setStep('name')} />
            <div data-testid="progress-dots" className="flex-1">
              <ProgressDots total={5} active={1} />
            </div>
            <CloseButton onClick={onClose} />
          </div>
          <h2
            className="text-[#2C2C2A] mb-2"
            style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '22px', lineHeight: '1.25' }}
          >
            What year were you born?
          </h2>
          <p className="text-[#888780] mb-6" style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', lineHeight: '1.55' }}>
            We use this to tailor recommendations to your life stage, nothing else.
          </p>
          <TextInput
            value={birthYear}
            onChange={setBirthYear}
            placeholder="e.g. 1988"
            type="number"
          />
          <Button onClick={() => onComplete()} disabled={!isBirthYearValid}>
            Continue
          </Button>
        </div>
      </div>
    )
  }

  return null
}
