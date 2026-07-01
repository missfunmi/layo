'use client'

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}

export function Button({ children, onClick, disabled = false, type = 'button' }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-[15px] rounded-full border-0 font-sans text-[15px] font-medium text-white mt-auto ${
        disabled ? 'bg-[#B4B2A9] cursor-not-allowed' : 'bg-[#0F6E56] cursor-pointer'
      }`}
    >
      {children}
    </button>
  )
}
