'use client'

import { useState } from 'react'
import { getOrCreateDeviceId } from '@/lib/device'
import { getRecommendationHeading, type RecommendationType } from '@/lib/recommendation'

type YesterdayWorkoutType = 'planned' | 'suggested' | 'other'

interface Recommendation {
  recommendationType: RecommendationType
  modificationDetail?: string | null
  rationale: string
}

interface CheckIn {
  sleepSatisfaction: number
  feelScore: number
  cycleDay?: number | null
  todaysPlannedWorkout: string
  yesterdayWorkoutType?: YesterdayWorkoutType | null
  stressors?: string | null
}

interface RecommendationViewProps {
  recommendation?: Recommendation
  checkIn?: CheckIn
  onRedo?: () => void
  isError?: boolean
  onRetry?: () => void
}

const STATE_COLORS: Record<RecommendationType, { overline: string; divider: string }> = {
  as_written: { overline: '#0F6E56', divider: '#5DCAA5' },
  modify: { overline: '#BA7517', divider: '#FAC775' },
  rest: { overline: '#993C1D', divider: '#F0997B' },
}

const YESTERDAY_LABELS: Record<YesterdayWorkoutType, string> = {
  planned: 'Planned workout',
  suggested: "Láyo's suggestion",
  other: 'Other workout',
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen).trimEnd() + '...'
}

function getHeaderDate(): string {
  return new Date()
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .replace(',', '')
}

function Header() {
  return (
    <div className="px-6 pt-[22px] flex items-center justify-between" style={{ minHeight: '52px' }}>
      <div className="font-display font-bold text-[#0F6E56] text-[21px] tracking-[-0.5px]">
        láyo
      </div>
      <div className="font-sans text-[12px] text-[#888780]">{getHeaderDate()}</div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline font-sans text-[12px] text-[#888780] py-1 border-b border-[#F1EFE8] last:border-b-0">
      <span>{label}</span>
      <span className="font-medium text-[#2C2C2A] text-right max-w-[58%] overflow-hidden text-ellipsis whitespace-nowrap">
        {value}
      </span>
    </div>
  )
}

const PLANNED_WORKOUT_TRUNCATE_LEN = 40

function PlannedWorkoutRow({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false)
  const isTruncatable = value.length > PLANNED_WORKOUT_TRUNCATE_LEN

  if (!isTruncatable) {
    return (
      <div className="flex justify-between items-baseline font-sans text-[12px] text-[#888780] py-1 border-b border-[#F1EFE8] last:border-b-0">
        <span>Planned workout</span>
        <span
          data-testid="planned-workout-value"
          className="font-medium text-[#2C2C2A] text-right max-w-[58%] overflow-hidden text-ellipsis whitespace-nowrap"
        >
          {value}
        </span>
      </div>
    )
  }

  return (
    <div
      className={`flex font-sans text-[12px] text-[#888780] py-1 border-b border-[#F1EFE8] last:border-b-0 ${
        expanded ? 'flex-col items-start gap-1' : 'justify-between items-baseline'
      }`}
    >
      <span>Planned workout</span>
      <button
        type="button"
        data-testid="planned-workout-value"
        aria-label={expanded ? 'Collapse planned workout' : 'Expand planned workout'}
        onClick={() => setExpanded((e) => !e)}
        className={`font-sans text-[12px] font-medium text-[#2C2C2A] bg-transparent border-0 p-0 cursor-pointer ${
          expanded ? 'text-left whitespace-normal w-full' : 'text-right max-w-[58%] overflow-hidden text-ellipsis whitespace-nowrap'
        }`}
      >
        {expanded ? value : truncate(value, PLANNED_WORKOUT_TRUNCATE_LEN)}
      </button>
    </div>
  )
}

export function RecommendationView({ recommendation, checkIn, onRedo, isError, onRetry }: RecommendationViewProps) {
  const [showRedoModal, setShowRedoModal] = useState(false)

  if (isError) {
    return (
      <div className="min-h-dvh bg-[#F1EFE8] flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <h1 className="font-display font-bold text-[24px] leading-[1.2] text-[#2C2C2A] mb-4 text-center">
            Something went wrong.
          </h1>
          <button
            onClick={onRetry}
            className="font-sans text-[14px] font-medium text-white py-[14px] px-8 rounded-full border-0 cursor-pointer"
            style={{ background: '#0F6E56' }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const { recommendationType, rationale, modificationDetail } = recommendation!
  const safeCheckIn = checkIn!
  const colors = STATE_COLORS[recommendationType]
  const heading = getRecommendationHeading(recommendationType, modificationDetail)

  async function handleConfirmRedo() {
    const today = new Date().toLocaleDateString('en-CA')
    await fetch(`/api/check-ins?date=${today}`, {
      method: 'DELETE',
      headers: { 'X-Device-ID': getOrCreateDeviceId() },
    })
    onRedo?.()
  }

  return (
    <div className="min-h-dvh bg-[#F1EFE8] flex flex-col relative">
      <Header />
      <div className="flex-1 flex flex-col px-6 pb-7 pt-[22px]">
        <div
          data-testid="overline"
          className="font-sans text-[11px] font-medium uppercase tracking-[0.09em] mb-[10px]"
          style={{ color: colors.overline }}
        >
          Today&apos;s recommendation
        </div>

        <h1 className="font-display font-bold text-[24px] leading-[1.2] text-[#2C2C2A] mb-[14px]">
          {heading}
        </h1>

        <div
          data-testid="verdict-divider"
          className="rounded-[1px] mb-4"
          style={{ height: '2px', backgroundColor: colors.divider }}
        />

        <p className="font-sans text-[14px] text-[#5F5E5A] leading-[1.65] mb-[22px]">
          {rationale}
        </p>

        <div className="bg-white border border-[#D3D1C7] rounded-[16px] px-4 py-[14px] mb-auto">
          <div className="font-sans text-[10px] font-medium uppercase tracking-[0.08em] text-[#B4B2A9] mb-[10px]">
            Today&apos;s check-in
          </div>
          <SummaryRow label="Sleep" value={`${safeCheckIn.sleepSatisfaction} / 5`} />
          <SummaryRow label="Feel" value={`${safeCheckIn.feelScore} / 5`} />
          {safeCheckIn.cycleDay != null && (
            <SummaryRow label="Cycle day" value={String(safeCheckIn.cycleDay)} />
          )}
          <PlannedWorkoutRow value={safeCheckIn.todaysPlannedWorkout} />
          {safeCheckIn.yesterdayWorkoutType != null && (
            <SummaryRow
              label="Yesterday"
              value={YESTERDAY_LABELS[safeCheckIn.yesterdayWorkoutType]}
            />
          )}
          {safeCheckIn.stressors != null && (
            <SummaryRow label="Stressors" value={safeCheckIn.stressors} />
          )}
        </div>

        <div className="flex justify-end pt-[18px]">
          <button
            onClick={() => setShowRedoModal(true)}
            className="font-sans text-[14px] text-[#888780] flex items-center gap-[5px] bg-transparent border-0 p-0 cursor-pointer no-underline"
            style={{ textDecoration: 'none' }}
          >
            <i className="ti ti-reload" />
            Redo today&apos;s check-in
          </button>
        </div>
      </div>

      {showRedoModal && (
        <div
          className="absolute inset-0 flex items-end"
          style={{ background: 'rgba(44,44,42,0.5)' }}
        >
          <div className="w-full bg-white rounded-t-[24px] px-6 py-8">
            <div className="font-display font-bold text-[18px] text-[#2C2C2A] mb-2">
              Redo today&apos;s check-in?
            </div>
            <div className="font-sans text-[14px] text-[#888780] leading-[1.6] mb-6">
              This will delete your check-in and recommendation for today. This cannot be undone.
            </div>
            <button
              onClick={handleConfirmRedo}
              className="w-full py-[14px] rounded-full border-0 font-sans text-[14px] font-medium text-white cursor-pointer mb-[10px]"
              style={{ background: '#D85A30' }}
            >
              Delete and redo
            </button>
            <button
              onClick={() => setShowRedoModal(false)}
              className="w-full py-[14px] rounded-full font-sans text-[14px] font-medium bg-transparent cursor-pointer"
              style={{ border: '1.5px solid #D3D1C7', color: '#5F5E5A' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
