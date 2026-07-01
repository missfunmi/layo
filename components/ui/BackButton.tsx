'use client'

interface BackButtonProps {
  onClick: () => void
}

export function BackButton({ onClick }: BackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '34px',
        height: '34px',
        borderRadius: '50%',
        border: '1.5px solid #D3D1C7',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#5F5E5A',
        flexShrink: 0,
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <i className="ti ti-arrow-left" style={{ fontSize: '16px' }} />
    </button>
  )
}
