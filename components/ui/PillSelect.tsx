'use client'

interface PillSelectProps {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function PillSelect({ options, selected, onChange }: PillSelectProps) {
  function toggle(option: string) {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option))
    } else {
      onChange([...selected, option])
    }
  }

  return (
    <div className="flex flex-wrap gap-[8px]">
      {options.map((option) => {
        const isSelected = selected.includes(option)
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={`font-sans text-[13px] font-medium py-[9px] px-[16px] rounded-full border-[1.5px] border-solid cursor-pointer ${
              isSelected
                ? 'bg-[#E1F5EE] border-[#0F6E56] text-[#085041]'
                : 'bg-white border-[#D3D1C7] text-[#5F5E5A]'
            }`}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
