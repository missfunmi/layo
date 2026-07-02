'use client'

interface CloseButtonProps {
  onClick: () => void
}

export function CloseButton({ onClick }: CloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="flex items-center justify-center p-[8px] text-[#B4B2A9] cursor-pointer bg-transparent border-0 flex-shrink-0"
    >
      <i className="ti ti-x text-[16px]" />
    </button>
  )
}
