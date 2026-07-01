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
      style={{
        width: '100%',
        padding: '15px',
        borderRadius: '100px',
        border: 'none',
        background: disabled ? '#B4B2A9' : '#0F6E56',
        color: '#fff',
        fontFamily: 'var(--font-inter), sans-serif',
        fontSize: '15px',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        marginTop: 'auto',
      }}
    >
      {children}
    </button>
  )
}
