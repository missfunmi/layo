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
  const isActive = focused || value.length > 0

  // text-[16px] is a hard floor, not a style choice: iOS Safari auto-zooms the viewport on
  // focus for any input under 16px, which breaks layout on this and every subsequent page
  // (LAYO-62, reintroduced and re-fixed on TextInput in LAYO-132). Do not add a smaller-font variant here.
  return (
    <div>
      <textarea
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`w-full bg-white rounded-[14px] py-[13px] px-[15px] font-sans text-[16px] outline-none min-h-[110px] resize-none leading-[1.5] box-border border-[1.5px] border-solid ${
          isActive ? 'border-[#0F6E56] text-[#2C2C2A]' : 'border-[#D3D1C7] text-[#B4B2A9]'
        }`}
      />
      <div className="font-sans text-[11px] text-[#B4B2A9] text-right">
        {value.length}/{maxLength}
      </div>
    </div>
  )
}
