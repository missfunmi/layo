'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/TextInput'
import { BackButton } from '@/components/ui/BackButton'
import { CloseButton } from '@/components/ui/CloseButton'
import { ProgressDots } from '@/components/ui/ProgressDots'
import { PillSelect } from '@/components/ui/PillSelect'

type Step = 'welcome' | 'name' | 'birth_year' | 'hormonal_life_stage'

const HORMONAL_OPTIONS = [
  'Menstruating',
  'Pregnant',
  'Menopausal',
  'Post-menopausal',
  'On birth control',
  'On HRT',
]

interface OnboardingFlowProps {
  onClose: () => void
  onComplete: () => void
}

export function OnboardingFlow({ onClose, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<Step>('welcome')
  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [hormonalLifeStage, setHormonalLifeStage] = useState<string[]>([])

  const currentYear = new Date().getFullYear()
  const minYear = currentYear - 100
  const maxYear = currentYear - 13

  const isNameValid = name.trim().length >= 1 && name.trim().length <= 50

  const birthYearNum = parseInt(birthYear, 10)
  const isBirthYearValid =
    /^\d{4}$/.test(birthYear) &&
    birthYearNum >= minYear &&
    birthYearNum <= maxYear

  if (step === 'welcome') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-layo-bg">
        <div className="text-center px-8 py-10">
          <div className="font-display font-bold text-[#0F6E56] text-[52px] tracking-[-1.5px] mb-[10px]">
            láyo
          </div>
          <div className="font-sans text-[#888780] text-[14px] leading-[1.65] mb-12">
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
      <div className="flex flex-col min-h-screen bg-layo-bg">
        <div className="px-6 pt-[22px] flex items-center" style={{ minHeight: '52px' }}>
          <div className="font-display font-bold text-[#0F6E56] text-[21px] tracking-[-0.5px]">
            láyo
          </div>
        </div>
        <div className="flex flex-col flex-1 px-6 pt-[22px] pb-7">
          <div className="flex items-center gap-[10px] mb-6">
            <BackButton onClick={() => setStep('welcome')} />
            <div data-testid="progress-dots" className="flex-1">
              <ProgressDots total={5} active={0} />
            </div>
            <CloseButton onClick={onClose} />
          </div>
          <h2 className="font-display font-bold text-[#2C2C2A] text-[22px] leading-[1.25] mb-2">
            What should we call you?
          </h2>
          <p className="font-sans text-[#888780] text-[13px] leading-[1.55] mb-6">
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
      <div className="flex flex-col min-h-screen bg-layo-bg">
        <div className="px-6 pt-[22px] flex items-center" style={{ minHeight: '52px' }}>
          <div className="font-display font-bold text-[#0F6E56] text-[21px] tracking-[-0.5px]">
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
          <h2 className="font-display font-bold text-[#2C2C2A] text-[22px] leading-[1.25] mb-2">
            What year were you born?
          </h2>
          <p className="font-sans text-[#888780] text-[13px] leading-[1.55] mb-6">
            We use this to tailor recommendations to your life stage, nothing else.
          </p>
          <TextInput
            value={birthYear}
            onChange={setBirthYear}
            placeholder="e.g. 1988"
            type="number"
          />
          <Button onClick={() => setStep('hormonal_life_stage')} disabled={!isBirthYearValid}>
            Continue
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'hormonal_life_stage') {
    return (
      <div className="flex flex-col min-h-screen bg-layo-bg">
        <div className="px-6 pt-[22px] flex items-center" style={{ minHeight: '52px' }}>
          <div className="font-display font-bold text-[#0F6E56] text-[21px] tracking-[-0.5px]">
            láyo
          </div>
        </div>
        <div className="flex flex-col flex-1 px-6 pt-[22px] pb-7">
          <div className="flex items-center gap-[10px] mb-6">
            <BackButton onClick={() => setStep('birth_year')} />
            <div data-testid="progress-dots" className="flex-1">
              <ProgressDots total={5} active={2} />
            </div>
            <CloseButton onClick={onClose} />
          </div>
          <h2 className="font-display font-bold text-[#2C2C2A] text-[22px] leading-[1.25] mb-2">
            Which of these applies to you?
          </h2>
          <p className="font-sans text-[#888780] text-[13px] leading-[1.55] mb-6">
            Hormones affect training more than most plans account for, and this helps Láyo give you better guidance.
          </p>
          <PillSelect
            options={HORMONAL_OPTIONS}
            selected={hormonalLifeStage}
            onChange={setHormonalLifeStage}
          />
          <Button onClick={() => onComplete()} disabled={hormonalLifeStage.length === 0}>
            Continue
          </Button>
        </div>
      </div>
    )
  }

  return null
}
