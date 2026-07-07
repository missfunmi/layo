'use client'

import { useState, useEffect } from 'react'
import { BackButton } from '@/components/ui/BackButton'
import { CloseButton } from '@/components/ui/CloseButton'
import { ProgressDots } from '@/components/ui/ProgressDots'
import { getOrCreateDeviceId } from '@/lib/device'

interface OuraConnectStepProps {
  onBack: () => void
  onClose: () => void
  onContinue: () => void
  active: number
  total: number
}

type ConnectionState = 'default' | 'connected' | 'error'

export function OuraConnectStep({ onBack, onClose, onContinue, active, total }: OuraConnectStepProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('default')
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const wearable = params.get('wearable')
    if (wearable === 'connected') {
      setConnectionState('connected')
      return
    }
    if (wearable === 'error') {
      setConnectionState('error')
      return
    }
    const deviceId = getOrCreateDeviceId()
    fetch('/api/wearables', { headers: { 'X-Device-ID': deviceId } })
      .then((r) => r.json())
      .then((data) => {
        if (data.connections?.some((c: { status: string }) => c.status === 'active')) {
          setConnectionState('connected')
        }
      })
      .catch(() => {})
  }, [])

  async function handleConnect() {
    setIsConnecting(true)
    try {
      const deviceId = getOrCreateDeviceId()
      const res = await fetch('/api/wearables/oura/authorize', {
        headers: { 'X-Device-ID': deviceId },
      })
      const data = await res.json() as { authorizationUrl: string }
      window.location.href = data.authorizationUrl
    } catch {
      setIsConnecting(false)
    }
  }

  const subtextMb =
    connectionState === 'connected' ? 'mb-6' : connectionState === 'error' ? 'mb-5' : 'mb-8'

  return (
    <div className="flex flex-col min-h-dvh bg-layo-bg">
      <div className="px-6 pt-[22px] flex items-center" style={{ minHeight: '52px' }}>
        <div className="font-display font-bold text-[#0F6E56] text-[21px] tracking-[-0.5px]">
          láyo
        </div>
      </div>
      <div className="flex items-center gap-[10px] mb-6 px-6 pt-[22px]">
        <BackButton onClick={onBack} />
        <div data-testid="progress-dots" className="flex-1">
          <ProgressDots total={total} active={active} />
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <div className="flex flex-col flex-1 px-6 pb-7">
        <h2 className="font-display font-bold text-[#2C2C2A] text-[22px] leading-[1.25] mb-[10px]">
          Connect your Oura Ring
        </h2>
        <p className={`font-sans text-[#888780] text-[13px] leading-[1.55] ${subtextMb}`}>
          Láyo can use your readiness, HRV, and sleep data to give you sharper recommendations. You don&apos;t need Oura, but if you have one, this helps.
        </p>

        {connectionState === 'connected' && (
          <div
            className="flex items-center gap-[10px] mb-6 rounded-[14px] px-[15px] py-[13px]"
            style={{ background: '#E1F5EE', border: '1.5px solid #0F6E56' }}
          >
            <div
              className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{ width: '28px', height: '28px', background: '#0F6E56' }}
            >
              <i className="ti ti-check" style={{ fontSize: '14px', color: '#fff' }} />
            </div>
            <span className="font-sans font-medium text-[13px]" style={{ color: '#085041' }}>
              Oura Ring connected
            </span>
          </div>
        )}

        {connectionState === 'error' && (
          <div
            className="flex items-start gap-2 rounded-[12px] px-[13px] py-[10px] mb-[18px]"
            style={{ background: '#FAECE7', border: '1.5px solid #F0997B' }}
          >
            <i
              className="ti ti-info-circle flex-shrink-0 mt-[1px]"
              style={{ fontSize: '15px', color: '#D85A30' }}
            />
            <span className="font-sans text-[12px] leading-[1.5]" style={{ color: '#993C1D' }}>
              Couldn&apos;t connect Oura. Try again or skip for now.
            </span>
          </div>
        )}

        <div className="mt-auto">
          <button
            type="button"
            onClick={connectionState === 'connected' ? onContinue : () => void handleConnect()}
            disabled={isConnecting}
            className="w-full py-[15px] rounded-full border-0 font-sans text-[15px] font-medium text-white cursor-pointer mb-[14px]"
            style={{ background: '#0F6E56' }}
          >
            {connectionState === 'connected' ? 'Continue' : 'Connect Oura Ring'}
          </button>
          {connectionState !== 'connected' && (
            <button
              type="button"
              onClick={onContinue}
              className="font-sans text-[12px] text-center cursor-pointer bg-transparent border-0 block w-full"
              style={{ color: '#B4B2A9' }}
            >
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
