'use client'

import { useState } from 'react'

interface TextAreaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
}

export function TextArea({ value, onChange, placeholder, maxLength = 280 }: TextAreaProps) {
  const [focused, setFocused] = useState(false)
  const isFilled = value.length > 0

  return (
    <div>
      <textarea
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
          fontSize: '13px',
          color: isFilled ? '#2C2C2A' : '#B4B2A9',
          outline: 'none',
          minHeight: '110px',
          resize: 'none',
          lineHeight: 1.5,
          boxSizing: 'border-box',
        }}
      />
      <div
        style={{
          fontFamily: 'var(--font-inter), sans-serif',
          fontSize: '11px',
          color: '#B4B2A9',
          textAlign: 'right',
        }}
      >
        {value.length}/{maxLength}
      </div>
    </div>
  )
}
