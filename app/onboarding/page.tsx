'use client'

import { useRouter } from 'next/navigation'
import { OnboardingFlow } from '@/components/flows/onboarding/OnboardingFlow'

export default function OnboardingPage() {
  const router = useRouter()
  return <OnboardingFlow onClose={() => router.push('/')} />
}
