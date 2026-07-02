'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { BackButton } from '@/components/ui/BackButton'
import { CloseButton } from '@/components/ui/CloseButton'
import { ProgressDots } from '@/components/ui/ProgressDots'
import { OptionCard } from '@/components/ui/OptionCard'
import { TextArea } from '@/components/ui/TextArea'
import { ScaleInput } from '@/components/ui/ScaleInput'
import { YesNoSelector } from '@/components/ui/YesNoSelector'

type Step = 'landing' | 'yesterday_workout' | 'yesterday_feedback' | 'today_workout' | 'sleep_feel' | 'cycle_tracking'

interface PreviousCheckIn {
  plannedWorkout?: string
  recommendationHeading?: string
}

interface CheckInFlowProps {
  name: string
  previousCheckIn?: PreviousCheckIn | null
  hormonalLifeStage?: string[]
  onClose?: () => void
}

function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function getHeaderDate(): string {
  return new Date()
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .replace(',', '')
}

function Header({ headerDate }: { headerDate: string }) {
  return (
    <div className="px-6 pt-[22px] flex items-center justify-between" style={{ minHeight: '52px' }}>
      <div className="font-display font-bold text-[#0F6E56] text-[21px] tracking-[-0.5px]">
        láyo
      </div>
      <div className="font-sans text-[11px] text-[#B4B2A9]">
        {headerDate}
      </div>
    </div>
  )
}

function StepHeader({
  onBack,
  active,
  onClose,
  headerDate,
}: {
  onBack: () => void
  active: number
  onClose?: () => void
  headerDate: string
}) {
  return (
    <>
      <Header headerDate={headerDate} />
      <div className="flex items-center gap-[10px] mb-5 px-6 pt-5">
        <BackButton onClick={onBack} />
        <div data-testid="progress-dots" className="flex-1">
          <ProgressDots total={6} active={active} />
        </div>
        <CloseButton onClick={onClose ?? (() => {})} />
      </div>
    </>
  )
}

export function CheckInFlow({ name, previousCheckIn, hormonalLifeStage, onClose }: CheckInFlowProps) {
  const [step, setStep] = useState<Step>('landing')
  const [yesterdayWorkout, setYesterdayWorkout] = useState<string | null>(null)
  const [somethingElseText, setSomethingElseText] = useState('')
  const [yesterdayFeedback, setYesterdayFeedback] = useState('')
  const [todayWorkout, setTodayWorkout] = useState('')
  const [sleepScore, setSleepScore] = useState<number | null>(null)
  const [feelScore, setFeelScore] = useState<number | null>(null)
  const [periodStartedToday, setPeriodStartedToday] = useState<boolean | null>(null)

  const greeting = getGreeting(new Date().getHours())
  const headerDate = getHeaderDate()

  const hasPreviousRecord = previousCheckIn != null

  const isYesterdayWorkoutValid =
    yesterdayWorkout !== null &&
    (yesterdayWorkout !== 'something_else' || somethingElseText.trim().length >= 1)

  if (step === 'landing') {
    return (
      <div className="flex flex-col min-h-screen bg-layo-bg">
        <Header headerDate={headerDate} />
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
          <Button onClick={() => setStep(hasPreviousRecord ? 'yesterday_workout' : 'today_workout')}>
            Start today&apos;s check-in
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'yesterday_workout') {
    return (
      <div className="flex flex-col min-h-screen bg-layo-bg">
        <StepHeader onBack={() => setStep('landing')} active={0} onClose={onClose} headerDate={headerDate} />
        <div className="flex flex-col flex-1 px-6 pb-7">
          <h2 className="font-display font-bold text-[#2C2C2A] text-[22px] leading-[1.25] mb-2">
            What did you do yesterday?
          </h2>
          <p className="font-sans text-[#888780] text-[13px] leading-[1.55] mb-5">
            Pick the closest match.
          </p>
          <div className="flex flex-col gap-[10px] mb-4">
            <OptionCard
              icon="ti-check"
              label="Your planned workout"
              detail={previousCheckIn?.plannedWorkout ?? 'No workout on record'}
              selected={yesterdayWorkout === 'planned'}
              onClick={() => { setYesterdayWorkout('planned'); setSomethingElseText('') }}
            />
            <OptionCard
              icon="ti-sparkles"
              label="Láyo's suggested workout"
              detail={previousCheckIn?.recommendationHeading ?? 'No suggestion on record'}
              selected={yesterdayWorkout === 'suggested'}
              onClick={() => { setYesterdayWorkout('suggested'); setSomethingElseText('') }}
            />
            <OptionCard
              icon="ti-edit"
              label="Something else"
              detail="Tell us what you did"
              selected={yesterdayWorkout === 'something_else'}
              onClick={() => setYesterdayWorkout('something_else')}
            />
          </div>
          {yesterdayWorkout === 'something_else' && (
            <div className="mb-4">
              <TextArea
                value={somethingElseText}
                onChange={setSomethingElseText}
                placeholder="What did you do?"
                maxLength={280}
              />
            </div>
          )}
          <Button onClick={() => setStep('yesterday_feedback')} disabled={!isYesterdayWorkoutValid}>
            Continue
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'yesterday_feedback') {
    return (
      <div className="flex flex-col min-h-screen bg-layo-bg">
        <StepHeader onBack={() => setStep('yesterday_workout')} active={1} onClose={onClose} headerDate={headerDate} />
        <div className="flex flex-col flex-1 px-6 pb-7">
          <h2 className="font-display font-bold text-[#2C2C2A] text-[22px] leading-[1.25] mb-2">
            How did it go?
          </h2>
          <p className="font-sans text-[#888780] text-[13px] leading-[1.55] mb-5">
            Anything worth noting about the session.
          </p>
          <TextArea
            value={yesterdayFeedback}
            onChange={setYesterdayFeedback}
            placeholder="E.g. felt strong, legs were heavy..."
            maxLength={280}
          />
          <Button onClick={() => setStep('today_workout')}>
            Continue
          </Button>
          <button
            type="button"
            onClick={() => setStep('today_workout')}
            className="font-sans text-[12px] text-[#B4B2A9] text-center mt-[10px] bg-transparent border-0 cursor-pointer"
          >
            Skip
          </button>
        </div>
      </div>
    )
  }

  if (step === 'today_workout') {
    const isTodayWorkoutValid = todayWorkout.trim().length >= 1
    const backStep = hasPreviousRecord ? 'yesterday_feedback' : 'landing'
    return (
      <div className="flex flex-col min-h-screen bg-layo-bg">
        <StepHeader onBack={() => setStep(backStep)} active={2} onClose={onClose} headerDate={headerDate} />
        <div className="flex flex-col flex-1 px-6 pb-7">
          <h2 className="font-display font-bold text-[#2C2C2A] text-[22px] leading-[1.25] mb-2">
            What workout do you have planned today?
          </h2>
          <p className="font-sans text-[#888780] text-[13px] leading-[1.55] mb-5">
            Be as specific as you like, distance, pace, intensity.
          </p>
          <div className="mb-4">
            <TextArea
              value={todayWorkout}
              onChange={setTodayWorkout}
              placeholder="E.g. 10mi tempo run, 2mi warmup, 6mi at marathon pace..."
              maxLength={280}
            />
          </div>
          <Button onClick={() => setStep('sleep_feel')} disabled={!isTodayWorkoutValid}>
            Continue
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'sleep_feel') {
    const isSleepFeelValid = sleepScore !== null && feelScore !== null
    return (
      <div className="flex flex-col min-h-screen bg-layo-bg">
        <StepHeader onBack={() => setStep('today_workout')} active={3} onClose={onClose} headerDate={headerDate} />
        <div className="flex flex-col flex-1 px-6 pb-7">
          <h2 className="font-display font-bold text-[#2C2C2A] text-[22px] leading-[1.25] mb-2">
            How did you sleep?
          </h2>
          <p className="font-sans text-[#888780] text-[13px] leading-[1.55] mb-4">
            1 = rough night, 5 = slept great
          </p>
          <div className="mb-6">
            <ScaleInput value={sleepScore} onChange={setSleepScore} labelLeft="rough" labelRight="great" />
          </div>
          <h2 className="font-display font-bold text-[#2C2C2A] text-[22px] leading-[1.25] mb-2">
            How do you feel?
          </h2>
          <p className="font-sans text-[#888780] text-[13px] leading-[1.55] mb-4">
            1 = dragging, 5 = ready to go
          </p>
          <div className="mb-6">
            <ScaleInput value={feelScore} onChange={setFeelScore} labelLeft="dragging" labelRight="ready to go" />
          </div>
          <Button
            onClick={() => setStep(hormonalLifeStage?.includes('menstruating') ? 'cycle_tracking' : 'landing')}
            disabled={!isSleepFeelValid}
          >
            Continue
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'cycle_tracking') {
    const isCycleValid = periodStartedToday !== null
    return (
      <div className="flex flex-col min-h-screen bg-layo-bg">
        <StepHeader onBack={() => setStep('sleep_feel')} active={4} onClose={onClose} headerDate={headerDate} />
        <div className="flex flex-col flex-1 px-6 pb-7">
          <h2 className="font-display font-bold text-[#2C2C2A] text-[22px] leading-[1.25] mb-2">
            Did your period start today?
          </h2>
          <p className="font-sans text-[#888780] text-[13px] leading-[1.55] mb-5">
            Láyo uses this to track where you are in your cycle. It stays private.
          </p>
          <div className="mb-6">
            <YesNoSelector value={periodStartedToday} onChange={setPeriodStartedToday} />
          </div>
          <Button onClick={() => setStep('landing')} disabled={!isCycleValid}>
            Continue
          </Button>
        </div>
      </div>
    )
  }

  return null
}
