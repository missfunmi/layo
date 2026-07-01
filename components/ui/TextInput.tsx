'use client'

import { useState } from 'react'

interface TextInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  type?: string
}

export function TextInput({ value, onChange, placeholder, maxLength, type = 'text' }: TextInputProps) {
  const [focused, setFocused] = useState(false)
  const isFilled = value.length > 0

  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%',
        background: '#fff',
        border: `1.5px solid ${focused || isFilled ? '#0F6E56' : '#D3D1C7'}`,
        borderRadius: '14px',
        padding: '13px 15px',
        fontFamily: 'var(--font-inter), sans-serif',
        fontSize: '14px',
        color: isFilled ? '#2C2C2A' : '#B4B2A9',
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  )
}
