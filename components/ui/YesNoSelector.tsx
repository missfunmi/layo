'use client'

interface YesNoSelectorProps {
  value: boolean | null
  onChange: (value: boolean) => void
}

export function YesNoSelector({ value, onChange }: YesNoSelectorProps) {
  const options: { label: string; val: boolean }[] = [
    { label: 'Yes', val: true },
    { label: 'No', val: false },
  ]

  return (
    <div className="flex gap-[10px]">
      {options.map(({ label, val }) => {
        const isSelected = value === val
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(val)}
            className={`flex-1 py-[16px] rounded-[14px] border-[1.5px] border-solid font-sans text-[14px] font-medium cursor-pointer text-center ${
              isSelected
                ? 'bg-[#E1F5EE] border-[#0F6E56] text-[#085041]'
                : 'bg-white border-[#D3D1C7] text-[#2C2C2A]'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
