'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { BackButton } from '@/components/ui/BackButton'
import { CloseButton } from '@/components/ui/CloseButton'
import { ProgressDots } from '@/components/ui/ProgressDots'
import { OptionCard } from '@/components/ui/OptionCard'
import { TextArea } from '@/components/ui/TextArea'
import { ScaleInput } from '@/components/ui/ScaleInput'
import { YesNoSelector } from '@/components/ui/YesNoSelector'
import { getOrCreateDeviceId } from '@/lib/device'

type Step = 'landing' | 'yesterday_workout' | 'yesterday_feedback' | 'today_workout' | 'sleep_feel' | 'cycle_tracking' | 'stressors' | 'generating' | 'error'

type SubmissionError = 'check_in_failed' | 'recommendation_failed' | null

interface PreviousCheckIn {
  plannedWorkout?: string
  recommendationHeading?: string
}

interface CheckInFlowProps {
  name: string
  previousCheckIn?: PreviousCheckIn | null
  hormonalLifeStage?: string[]
  onClose?: () => void
  onSuccess?: () => void
}

const GENERATING_HEADERS = [
  'Reading the full picture...',
  "Let's see what we've got...",
  'Putting it all together...',
  'Give us just a moment...',
  'Almost ready for you...',
  'Working out the details...',
  'Checking in on everything...',
]

const WORKOUT_TYPE_MAP: Record<string, string> = {
  planned: 'planned',
  suggested: 'suggested',
  something_else: 'other',
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

export function CheckInFlow({ name, previousCheckIn, hormonalLifeStage, onClose, onSuccess }: CheckInFlowProps) {
  const [step, setStep] = useState<Step>('landing')
  const [yesterdayWorkout, setYesterdayWorkout] = useState<string | null>(null)
  const [somethingElseText, setSomethingElseText] = useState('')
  const [yesterdayFeedback, setYesterdayFeedback] = useState('')
  const [todayWorkout, setTodayWorkout] = useState('')
  const [sleepScore, setSleepScore] = useState<number | null>(null)
  const [feelScore, setFeelScore] = useState<number | null>(null)
  const [periodStartedToday, setPeriodStartedToday] = useState<boolean | null>(null)
  const [stressorsText, setStressorsText] = useState('')
  const [submissionError, setSubmissionError] = useState<SubmissionError>(null)
  const [generatingHeader] = useState(
    () => GENERATING_HEADERS[Math.floor(Math.random() * GENERATING_HEADERS.length)]
  )

  const greeting = getGreeting(new Date().getHours())
  const headerDate = getHeaderDate()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (step !== 'generating') return

    const submit = async () => {
      try {
        const payload: Record<string, unknown> = {
          checkInDate: new Date().toLocaleDateString('en-CA'),
          todaysPlannedWorkout: todayWorkout,
          sleepScore,
          feelScore,
        }
        if (yesterdayWorkout) {
          payload.yesterdayWorkoutType = WORKOUT_TYPE_MAP[yesterdayWorkout]
          if (yesterdayWorkout === 'something_else') {
            payload.yesterdayWorkoutDescription = somethingElseText
          }
        }
        if (yesterdayFeedback) {
          payload.yesterdayWorkoutFeedback = yesterdayFeedback
        }
        if (hormonalLifeStage?.includes('menstruating')) {
          payload.periodStartedToday = periodStartedToday
        }
        if (stressorsText) {
          payload.stressors = stressorsText
        }

        const response = await fetch('/api/check-ins', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-ID': getOrCreateDeviceId(),
          },
          body: JSON.stringify(payload),
        })

        if (response.ok) {
          onSuccess?.()
        } else {
          const data = await response.json().catch(() => ({}))
          setSubmissionError(data.checkInSaved ? 'recommendation_failed' : 'check_in_failed')
          setStep('error')
        }
      } catch {
        setSubmissionError('check_in_failed')
        setStep('error')
      }
    }

    submit()
  }, [step])

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
            onClick={() => setStep(hormonalLifeStage?.includes('menstruating') ? 'cycle_tracking' : 'stressors')}
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
          <Button onClick={() => setStep('stressors')} disabled={!isCycleValid}>
            Continue
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'stressors') {
    const backStep = hormonalLifeStage?.includes('menstruating') ? 'cycle_tracking' : 'sleep_feel'
    return (
      <div className="flex flex-col min-h-screen bg-layo-bg">
        <StepHeader onBack={() => setStep(backStep)} active={5} onClose={onClose} headerDate={headerDate} />
        <div className="flex flex-col flex-1 px-6 pb-7">
          <h2 className="font-display font-bold text-[#2C2C2A] text-[22px] leading-[1.25] mb-2">
            Anything new since yesterday?
          </h2>
          <p className="font-sans text-[#888780] text-[13px] leading-[1.55] mb-5">
            Travel, illness, bad news, a harder-than-usual day? This helps Láyo read the full picture.
          </p>
          <TextArea
            value={stressorsText}
            onChange={setStressorsText}
            placeholder="E.g. bad night's sleep, stressful day at work, feeling under the weather..."
            maxLength={280}
          />
          <Button onClick={() => setStep('generating')}>
            Continue
          </Button>
          <button
            type="button"
            onClick={() => setStep('generating')}
            className="font-sans text-[12px] text-[#B4B2A9] text-center mt-[10px] bg-transparent border-0 cursor-pointer"
          >
            Skip
          </button>
        </div>
      </div>
    )
  }

  if (step === 'generating') {
    return (
      <div className="flex flex-col min-h-screen bg-layo-bg">
        <Header headerDate={headerDate} />
        <div className="flex flex-col flex-1 items-center justify-center text-center px-6 pb-7">
          <div
            className="rounded-full mb-[22px]"
            style={{
              width: '64px',
              height: '64px',
              border: '3px solid #E1F5EE',
              borderTopColor: '#0F6E56',
              animation: 'spin 1s linear infinite',
            }}
          />
          <h2 className="font-display font-bold text-[#2C2C2A] text-[20px] mb-[10px]">
            {generatingHeader}
          </h2>
          <p className="font-sans text-[#888780] text-[13px] leading-[1.65]" style={{ maxWidth: '210px' }}>
            Láyo is working on your recommendation for today.
          </p>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    const bodyText =
      submissionError === 'recommendation_failed'
        ? 'We saved your check-in but could not generate a recommendation. Tap to try again.'
        : 'We could not save your check-in. Tap to try again.'

    return (
      <div className="flex flex-col min-h-screen bg-layo-bg">
        <Header headerDate={headerDate} />
        <div className="flex flex-col flex-1 items-center justify-center text-center px-6 pb-7">
          <div
            className="rounded-full flex items-center justify-center mb-[18px]"
            style={{ width: '56px', height: '56px', background: '#FAECE7', color: '#D85A30' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="font-display font-bold text-[#2C2C2A] text-[20px] mb-2">
            Something went wrong.
          </h2>
          <p className="font-sans text-[#888780] text-[13px] leading-[1.6] mb-7" style={{ maxWidth: '220px' }}>
            {bodyText}
          </p>
          <button
            type="button"
            onClick={() => {
              setSubmissionError(null)
              setStep('generating')
            }}
            className="px-7 py-[14px] rounded-full border-0 font-sans text-[14px] font-medium text-white bg-[#0F6E56] cursor-pointer"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return null
}
