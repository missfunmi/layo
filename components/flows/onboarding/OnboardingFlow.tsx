'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/TextInput'
import { BackButton } from '@/components/ui/BackButton'
import { CloseButton } from '@/components/ui/CloseButton'
import { ProgressDots } from '@/components/ui/ProgressDots'
import { PillSelect } from '@/components/ui/PillSelect'
import { SingleSelect } from '@/components/ui/SingleSelect'
import { PickerField } from '@/components/ui/PickerField'
import { DateField } from '@/components/ui/DateField'
import { OuraConnectStep } from '@/components/flows/onboarding/OuraConnectStep'
import { getOrCreateDeviceId, generateCorrelationId } from '@/lib/device'

type Step =
  | 'welcome'
  | 'name'
  | 'birth_year'
  | 'hormonal_life_stage'
  | 'training_goal'
  | 'oura_connect'
  | 'confirmation'

const HORMONAL_OPTIONS = [
  'Menstruating',
  'Pregnant',
  'Menopausal',
  'Post-menopausal',
  'On birth control',
  'On HRT',
]

const HORMONAL_STAGE_MAP: Record<string, string> = {
  'Menstruating': 'menstruating',
  'Pregnant': 'pregnant',
  'Menopausal': 'menopausal',
  'Post-menopausal': 'post-menopausal',
  'On birth control': 'on_birth_control',
  'On HRT': 'on_hrt',
}

const TRAINING_GOAL_OPTIONS = ['A specific race', 'Other reasons']

const EVENT_TYPES = ['Running', 'Cycling', 'Swimming', 'Triathlon', 'Skiing', 'Other']

interface OnboardingFlowProps {
  onClose: () => void
}

function StepHeader({ onBack, active, onClose }: { onBack: () => void; active: number; onClose: () => void }) {
  return (
    <>
      <div className="px-6 pt-[22px] flex items-center" style={{ minHeight: '52px' }}>
        <div className="font-display font-bold text-[#0F6E56] text-[21px] tracking-[-0.5px]">
          láyo
        </div>
      </div>
      <div className="flex items-center gap-[10px] mb-6 px-6 pt-[22px]">
        <BackButton onClick={onBack} />
        <div data-testid="progress-dots" className="flex-1">
          <ProgressDots total={5} active={active} />
        </div>
        <CloseButton onClick={onClose} />
      </div>
    </>
  )
}

const FORM_STORAGE_KEY = 'layo_onboarding_form'

type SavedForm = {
  name: string
  birthYear: string
  hormonalLifeStage: string[]
  trainingGoal: string | null
  eventName: string
  eventType: string
  eventTypeDetail: string
  eventDate: string
}

export function OnboardingFlow({ onClose }: OnboardingFlowProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('welcome')
  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [hormonalLifeStage, setHormonalLifeStage] = useState<string[]>([])
  const [trainingGoal, setTrainingGoal] = useState<string | null>(null)
  const [eventName, setEventName] = useState('')
  const [eventType, setEventType] = useState('')
  const [eventTypeDetail, setEventTypeDetail] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [confirmationError, setConfirmationError] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const wearable = params.get('wearable')
    if (wearable === 'connected' || wearable === 'error') {
      const raw = sessionStorage.getItem(FORM_STORAGE_KEY)
      if (raw) {
        try {
          const saved = JSON.parse(raw) as SavedForm
          setName(saved.name)
          setBirthYear(saved.birthYear)
          setHormonalLifeStage(saved.hormonalLifeStage)
          setTrainingGoal(saved.trainingGoal)
          setEventName(saved.eventName)
          setEventType(saved.eventType)
          setEventTypeDetail(saved.eventTypeDetail)
          setEventDate(saved.eventDate)
        } catch {
          // ignore malformed storage
        }
      }
      setStep('oura_connect')
    }
  }, [])

  const currentYear = new Date().getFullYear()
  const minYear = currentYear - 100
  const maxYear = currentYear - 13
  const today = new Date().toLocaleDateString('en-CA')

  async function submitOnboarding() {
    setConfirmationError(false)
    const deviceId = getOrCreateDeviceId()

    const payload: Record<string, unknown> = {
      deviceId,
      name: name.trim(),
      birthYear: parseInt(birthYear, 10),
      hormonalLifeStage: hormonalLifeStage.map(s => HORMONAL_STAGE_MAP[s] ?? s.toLowerCase()),
      trainingGoal: trainingGoal === 'A specific race' ? 'race' : 'non_race',
    }

    if (trainingGoal === 'A specific race') {
      payload.eventName = eventName.trim()
      payload.eventType = eventType.toLowerCase()
      if (eventType === 'Other') {
        payload.eventTypeOther = eventTypeDetail.trim()
      }
      payload.eventDate = eventDate
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': generateCorrelationId(),
        },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        sessionStorage.removeItem(FORM_STORAGE_KEY)
        router.push('/check-in')
      } else {
        setConfirmationError(true)
      }
    } catch {
      setConfirmationError(true)
    }
  }

  const isNameValid = name.trim().length >= 1 && name.trim().length <= 50

  const birthYearNum = parseInt(birthYear, 10)
  const isBirthYearValid =
    /^\d{4}$/.test(birthYear) &&
    birthYearNum >= minYear &&
    birthYearNum <= maxYear

  const isEventNameValid = eventName.trim().length >= 1 && eventName.trim().length <= 100
  const isEventTypeValid = eventType.length > 0
  const isEventTypeDetailValid =
    eventType !== 'Other' || (eventTypeDetail.trim().length >= 1 && eventTypeDetail.trim().length <= 50)
  const isEventDateValid = eventDate.length > 0 && eventDate > today
  const isRaceDetailsValid =
    isEventNameValid && isEventTypeValid && isEventTypeDetailValid && isEventDateValid

  if (step === 'welcome') {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-layo-bg">
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
      <div className="flex flex-col min-h-dvh bg-layo-bg">
        <StepHeader onBack={() => setStep('welcome')} active={0} onClose={onClose} />
        <div className="flex flex-col flex-1 px-6 pb-7">
          <h2 className="font-display font-bold text-[#2C2C2A] text-[22px] leading-[1.25] mb-2">
            What should we call you?
          </h2>
          <p className="font-sans text-[#888780] text-[14px] leading-[1.55] mb-6">
            This is how Láyo will address you.
          </p>
          <TextInput value={name} onChange={setName} placeholder="Your name" maxLength={50} />
          <Button onClick={() => setStep('birth_year')} disabled={!isNameValid}>
            Continue
          </Button>
          <button
            type="button"
            onClick={() => router.push('/restore')}
            className="font-sans text-[12px] text-[#B4B2A9] text-center mt-[14px] bg-transparent border-0 cursor-pointer"
          >
            Already used Láyo?
          </button>
        </div>
      </div>
    )
  }

  if (step === 'birth_year') {
    return (
      <div className="flex flex-col min-h-dvh bg-layo-bg">
        <StepHeader onBack={() => setStep('name')} active={1} onClose={onClose} />
        <div className="flex flex-col flex-1 px-6 pb-7">
          <h2 className="font-display font-bold text-[#2C2C2A] text-[22px] leading-[1.25] mb-2">
            What year were you born?
          </h2>
          <p className="font-sans text-[#888780] text-[14px] leading-[1.55] mb-6">
            We use this to tailor recommendations to your life stage, nothing else.
          </p>
          <TextInput value={birthYear} onChange={setBirthYear} placeholder="e.g. 1988" type="number" />
          <Button onClick={() => setStep('hormonal_life_stage')} disabled={!isBirthYearValid}>
            Continue
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'hormonal_life_stage') {
    return (
      <div className="flex flex-col min-h-dvh bg-layo-bg">
        <StepHeader onBack={() => setStep('birth_year')} active={2} onClose={onClose} />
        <div className="flex flex-col flex-1 px-6 pb-7">
          <h2 className="font-display font-bold text-[#2C2C2A] text-[22px] leading-[1.25] mb-2">
            Which of these applies to you?
          </h2>
          <p className="font-sans text-[#888780] text-[14px] leading-[1.55] mb-6">
            Hormones affect training more than most plans account for, and this helps Láyo give you better guidance.
          </p>
          <PillSelect
            options={HORMONAL_OPTIONS}
            selected={hormonalLifeStage}
            onChange={setHormonalLifeStage}
          />
          <Button onClick={() => setStep('training_goal')} disabled={hormonalLifeStage.length === 0}>
            Continue
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'training_goal') {
    const isContinueDisabled =
      trainingGoal === null ||
      (trainingGoal === 'A specific race' && !isRaceDetailsValid)

    return (
      <div className="flex flex-col min-h-dvh bg-layo-bg">
        <StepHeader onBack={() => setStep('hormonal_life_stage')} active={3} onClose={onClose} />
        <div className="flex flex-col flex-1 px-6 pb-7">
          <h2 className="font-display font-bold text-[#2C2C2A] text-[22px] leading-[1.25] mb-6">
            What are you training for?
          </h2>
          <SingleSelect
            options={TRAINING_GOAL_OPTIONS}
            selected={trainingGoal}
            onChange={setTrainingGoal}
          />
          {trainingGoal === 'A specific race' && (
            <div className="mt-6">
              <p className="font-sans text-[#888780] text-[14px] leading-[1.55] mb-4">
                Láyo uses this to pace your recommendations as you get closer. If you&apos;re training for more than one race, tell us about the one coming up next. You can add others later.
              </p>
              <div className="mb-3">
                <TextInput
                  value={eventName}
                  onChange={setEventName}
                  placeholder="Event name"
                  maxLength={100}
                />
              </div>
              <div className="relative mb-3">
                <div className="pointer-events-none">
                  <PickerField value={eventType} onClick={() => {}} placeholder="Event type" />
                </div>
                <select
                  aria-label="Event type"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="absolute inset-0 opacity-0 w-full cursor-pointer z-10"
                >
                  <option value="" disabled>Event type</option>
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {eventType === 'Other' && (
                <div className="mb-3">
                  <TextInput
                    value={eventTypeDetail}
                    onChange={setEventTypeDetail}
                    placeholder="Type of event"
                    maxLength={50}
                  />
                </div>
              )}
              <div className="relative mb-3">
                <div className="pointer-events-none">
                  <DateField value={eventDate} onClick={() => {}} placeholder="Event date" />
                </div>
                <input
                  type="date"
                  aria-label="Event date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="absolute inset-0 opacity-0 w-full cursor-pointer z-10"
                />
              </div>
            </div>
          )}
          <Button
            onClick={() => {
              sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify({
                name, birthYear, hormonalLifeStage, trainingGoal,
                eventName, eventType, eventTypeDetail, eventDate,
              }))
              setStep('oura_connect')
            }}
            disabled={isContinueDisabled}
          >
            Continue
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'oura_connect') {
    return (
      <OuraConnectStep
        onBack={() => setStep('training_goal')}
        onClose={onClose}
        onContinue={() => {
          setStep('confirmation')
          void submitOnboarding()
        }}
        active={4}
        total={5}
      />
    )
  }

  if (step === 'confirmation') {
    if (confirmationError) {
      return (
        <div className="flex flex-col min-h-dvh bg-layo-bg">
          <div className="px-6 pt-[22px] flex items-center" style={{ minHeight: '52px' }}>
            <div className="font-display font-bold text-[#0F6E56] text-[21px] tracking-[-0.5px]">
              láyo
            </div>
          </div>
          <div className="flex flex-col flex-1 items-center justify-center text-center px-6">
            <div
              className="flex items-center justify-center rounded-full mb-5 mx-auto"
              style={{ width: '56px', height: '56px', backgroundColor: '#FAECE7' }}
            >
              <i className="ti ti-alert-circle" style={{ fontSize: '24px', color: '#D85A30' }} />
            </div>
            <h2 className="font-display font-bold text-[#2C2C2A] text-[20px] mb-2">
              Something went wrong.
            </h2>
            <p className="font-sans text-[#888780] text-[14px] leading-[1.6] mb-7">
              We could not save your profile. Tap to try again.
            </p>
            <button
              type="button"
              onClick={() => void submitOnboarding()}
              className="px-7 py-[14px] rounded-full bg-[#0F6E56] text-white font-sans text-[14px] font-medium cursor-pointer border-0"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col min-h-dvh bg-layo-bg">
        <div className="px-6 pt-[22px] flex items-center" style={{ minHeight: '52px' }}>
          <div className="font-display font-bold text-[#0F6E56] text-[21px] tracking-[-0.5px]">
            láyo
          </div>
        </div>
        <div className="flex flex-col flex-1 items-center justify-center text-center px-6">
          <div
            className="flex items-center justify-center rounded-full mb-5 mx-auto"
            style={{ width: '60px', height: '60px', backgroundColor: '#E1F5EE' }}
          >
            <i className="ti ti-check" style={{ fontSize: '28px', color: '#0F6E56' }} />
          </div>
          <h2 className="font-display font-bold text-[#2C2C2A] text-[24px] mb-3">
            You&apos;re all set, {name.trim()}.
          </h2>
          <p className="font-sans text-[#888780] text-[14px] leading-[1.65] max-w-[220px]">
            Come back tomorrow morning and Láyo will be ready for your first check-in.
          </p>
        </div>
      </div>
    )
  }

  return null
}
