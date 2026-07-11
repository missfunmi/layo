'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { Button } from '@/components/ui/Button'
import { setDeviceId } from '@/lib/device'

// A fixed-height, two-line textarea rather than a single-line input: deviceId is always
// exactly 36 characters, which doesn't fit on one line at the required 16px font-size in
// the available width, so it wraps instead of needing horizontal scroll. Fixed height (not
// min-height) keeps this static; overflow-y-auto is a safety net for anything pasted longer
// than expected, not the common case.
function PasteField({
  value,
  onChange,
  invalid,
}: {
  value: string
  onChange: (value: string) => void
  invalid: boolean
}) {
  const [focused, setFocused] = useState(false)
  const isActive = focused || value.length > 0

  return (
    <textarea
      value={value}
      placeholder="Paste here"
      rows={2}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={`w-full h-[72px] bg-white rounded-[14px] py-[13px] px-[15px] font-sans text-[16px] leading-[1.4] outline-none resize-none overflow-y-auto box-border border-[1.5px] border-solid ${
        invalid
          ? 'border-[#D85A30] text-[#2C2C2A]'
          : isActive
            ? 'border-[#0F6E56] text-[#2C2C2A]'
            : 'border-[#D3D1C7] text-[#B4B2A9]'
      }`}
    />
  )
}

export default function RestorePage() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function handleSubmit() {
    const pasted = value.trim()
    setError(false)
    setSubmitting(true)
    fetch('/api/users', { headers: { 'X-Device-ID': pasted } })
      .then((res) => {
        if (!res.ok) {
          setError(true)
          setSubmitting(false)
          return
        }
        setDeviceId(pasted)
        router.push('/')
      })
      .catch(() => {
        setError(true)
        setSubmitting(false)
      })
  }

  return (
    <div className="min-h-dvh bg-layo-bg flex flex-col">
      <div className="px-6 pt-[22px] flex items-center" style={{ minHeight: '52px' }}>
        <div className="font-display font-bold text-[#0F6E56] text-[21px] tracking-[-0.5px]">
          láyo
        </div>
      </div>
      <div className="px-6 pt-5">
        <BackButton onClick={() => router.push('/onboarding')} />
      </div>
      <div className="flex flex-col flex-1 px-6 pt-6 pb-7">
        <h2 className="font-display font-bold text-[#2C2C2A] text-[22px] leading-[1.25] mb-2">
          Welcome back
        </h2>
        <p className="font-sans text-[#888780] text-[14px] leading-[1.55] mb-6">
          Paste what&apos;s on your profile page to get your data back.
        </p>
        <PasteField
          value={value}
          onChange={(v) => {
            setValue(v)
            setError(false)
          }}
          invalid={error}
        />
        {error && (
          <p className="font-sans text-[12px] text-[#D85A30] leading-[1.5] mb-4">
            We don&apos;t recognize that. Double check what you pasted and try again.
          </p>
        )}
        <Button onClick={handleSubmit} disabled={!value.trim() || submitting}>
          Continue
        </Button>
      </div>
    </div>
  )
}
