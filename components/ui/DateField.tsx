'use client'

interface DateFieldProps {
  value: string
  onClick: () => void
  placeholder?: string
}

export function DateField({ value, onClick, placeholder }: DateFieldProps) {
  const isFilled = value.length > 0

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full bg-white rounded-[14px] py-[13px] px-[15px] font-sans text-[14px] flex items-center justify-between cursor-pointer text-left box-border border-[1.5px] border-solid ${
        isFilled ? 'border-[#0F6E56] text-[#2C2C2A]' : 'border-[#D3D1C7] text-[#B4B2A9]'
      }`}
    >
      <span>{isFilled ? value : placeholder}</span>
      <i className="ti ti-calendar text-[16px] text-[#B4B2A9] flex-shrink-0" />
    </button>
  )
}
