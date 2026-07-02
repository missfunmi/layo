'use client'

interface BackButtonProps {
  onClick: () => void
}

export function BackButton({ onClick }: BackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Go back"
      className="w-[34px] h-[34px] rounded-full border-[1.5px] border-solid border-[#D3D1C7] bg-white flex items-center justify-center text-[#5F5E5A] flex-shrink-0 cursor-pointer p-0"
    >
      <i className="ti ti-arrow-left text-[16px]" />
    </button>
  )
}
