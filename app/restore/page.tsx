'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/TextInput'
import { setDeviceId } from '@/lib/device'

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
        <TextInput
          value={value}
          onChange={(v) => {
            setValue(v)
            setError(false)
          }}
          placeholder="Paste here"
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
