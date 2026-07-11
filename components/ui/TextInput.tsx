'use client'

import { useState } from 'react'

interface TextInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  type?: string
  invalid?: boolean
  small?: boolean
}

export function TextInput({ value, onChange, placeholder, maxLength, type = 'text', invalid = false, small = false }: TextInputProps) {
  const [focused, setFocused] = useState(false)
  const isActive = focused || value.length > 0

  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={`w-full bg-white rounded-[14px] py-[13px] px-[15px] font-sans outline-none box-border border-[1.5px] border-solid ${
        small ? 'text-[13px]' : 'text-[16px]'
      } ${
        invalid
          ? 'border-[#D85A30] text-[#2C2C2A]'
          : isActive
            ? 'border-[#0F6E56] text-[#2C2C2A]'
            : 'border-[#D3D1C7] text-[#B4B2A9]'
      }`}
    />
  )
}
