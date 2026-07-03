'use client'

type RecommendationType = 'as_written' | 'modify' | 'rest'
type YesterdayWorkoutType = 'planned' | 'suggested' | 'other'

interface Recommendation {
  recommendationType: RecommendationType
  modificationDetail?: string | null
  rationale: string
}

interface CheckIn {
  sleepScore: number
  feelScore: number
  cycleDay?: number | null
  todaysPlannedWorkout: string
  yesterdayWorkoutType?: YesterdayWorkoutType | null
  stressors?: string | null
}

interface RecommendationViewProps {
  recommendation: Recommendation
  checkIn: CheckIn
  onRedo?: () => void
}

const STATE_COLORS: Record<RecommendationType, { overline: string; divider: string }> = {
  as_written: { overline: '#0F6E56', divider: '#5DCAA5' },
  modify: { overline: '#BA7517', divider: '#FAC775' },
  rest: { overline: '#993C1D', divider: '#F0997B' },
}

const STATE_HEADINGS: Partial<Record<RecommendationType, string>> = {
  as_written: 'Do your workout as planned.',
  rest: 'Take a rest day today.',
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
      <div className="font-sans text-[11px] text-[#B4B2A9]">{getHeaderDate()}</div>
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

export function RecommendationView({ recommendation, checkIn, onRedo }: RecommendationViewProps) {
  const { recommendationType, rationale, modificationDetail } = recommendation
  const colors = STATE_COLORS[recommendationType]
  const heading = STATE_HEADINGS[recommendationType] ?? modificationDetail ?? ''

  return (
    <div className="min-h-screen bg-[#F1EFE8] flex flex-col">
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
          <SummaryRow label="Sleep" value={`${checkIn.sleepScore} / 5`} />
          <SummaryRow label="Feel" value={`${checkIn.feelScore} / 5`} />
          {checkIn.cycleDay != null && (
            <SummaryRow label="Cycle day" value={String(checkIn.cycleDay)} />
          )}
          <SummaryRow label="Planned workout" value={truncate(checkIn.todaysPlannedWorkout, 40)} />
          {checkIn.yesterdayWorkoutType != null && (
            <SummaryRow
              label="Yesterday"
              value={YESTERDAY_LABELS[checkIn.yesterdayWorkoutType]}
            />
          )}
          {checkIn.stressors != null && (
            <SummaryRow label="Stressors" value={checkIn.stressors} />
          )}
        </div>

        <div className="flex justify-end pt-[18px]">
          <button
            onClick={onRedo}
            className="font-sans text-[12px] text-[#888780] flex items-center gap-[5px] bg-transparent border-0 p-0 cursor-pointer"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
            </svg>
            Redo today&apos;s check-in
          </button>
        </div>
      </div>
    </div>
  )
}
