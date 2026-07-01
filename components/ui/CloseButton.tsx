'use client'

interface CloseButtonProps {
  onClick: () => void
}

export function CloseButton({ onClick }: CloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
        color: '#B4B2A9',
        cursor: 'pointer',
        background: 'none',
        border: 'none',
        flexShrink: 0,
      }}
    >
      <i className="ti ti-x" style={{ fontSize: '16px' }} />
    </button>
  )
}
