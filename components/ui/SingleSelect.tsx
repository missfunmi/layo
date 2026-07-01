'use client'

interface SingleSelectProps {
  options: string[]
  selected: string | null
  onChange: (selected: string) => void
}

export function SingleSelect({ options, selected, onChange }: SingleSelectProps) {
  return (
    <div className="flex gap-[10px]">
      {options.map((option) => {
        const isSelected = selected === option
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`flex-1 py-[14px] px-[12px] rounded-[14px] border-[1.5px] border-solid font-sans text-[13px] font-medium cursor-pointer text-center ${
              isSelected
                ? 'bg-[#E1F5EE] border-[#0F6E56] text-[#085041]'
                : 'bg-white border-[#D3D1C7] text-[#2C2C2A]'
            }`}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
