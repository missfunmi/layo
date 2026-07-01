'use client'

interface ProgressDotsProps {
  total: number
  active: number
}

export function ProgressDots({ total, active }: ProgressDotsProps) {
  return (
    <div className="flex gap-[6px] items-center">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-[6px] transition-all duration-200 ${
            i === active
              ? 'w-[18px] rounded-[3px] bg-[#0F6E56]'
              : 'w-[6px] rounded-full bg-[#D3D1C7]'
          }`}
        />
      ))}
    </div>
  )
}
