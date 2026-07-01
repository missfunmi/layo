'use client'

interface ScaleInputProps {
  value: number | null
  onChange: (value: number) => void
  labelLeft?: string
  labelRight?: string
}

export function ScaleInput({ value, onChange, labelLeft, labelRight }: ScaleInputProps) {
  return (
    <div>
      <div className="flex gap-[8px] mb-[8px]">
        {[1, 2, 3, 4, 5].map((n) => {
          const isSelected = value === n
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`flex-1 h-[54px] rounded-[13px] border-[1.5px] border-solid flex items-center justify-center font-sans text-[17px] font-medium cursor-pointer ${
                isSelected
                  ? 'bg-[#E1F5EE] border-[#0F6E56] text-[#085041]'
                  : 'bg-white border-[#D3D1C7] text-[#5F5E5A]'
              }`}
            >
              {n}
            </button>
          )
        })}
      </div>
      {(labelLeft || labelRight) && (
        <div className="flex justify-between font-sans text-[11px] text-[#B4B2A9]">
          <span>{labelLeft}</span>
          <span>{labelRight}</span>
        </div>
      )}
    </div>
  )
}
