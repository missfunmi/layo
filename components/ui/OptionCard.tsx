'use client'

interface OptionCardProps {
  icon: string
  label: string
  detail?: string
  selected: boolean
  onClick: () => void
}

export function OptionCard({ icon, label, detail, selected, onClick }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border-[1.5px] border-solid py-[13px] px-[15px] flex items-center gap-[12px] cursor-pointer text-left ${
        selected ? 'bg-[#E1F5EE] border-[#0F6E56]' : 'bg-white border-[#D3D1C7]'
      }`}
    >
      <div
        className={`w-[36px] h-[36px] rounded-[10px] flex items-center justify-center flex-shrink-0 ${
          selected ? 'bg-[#9FE1CB] text-[#085041]' : 'bg-[#F1EFE8] text-[#0F6E56]'
        }`}
      >
        <i className={`ti ${icon} text-[16px]`} />
      </div>
      <div>
        <div className={`font-sans text-[13px] font-medium text-[#2C2C2A] ${detail ? 'mb-[2px]' : ''}`}>
          {label}
        </div>
        {detail && (
          <div className="font-sans text-[12px] text-[#888780] leading-[1.4]">
            {detail}
          </div>
        )}
      </div>
    </button>
  )
}
