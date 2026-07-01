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
      style={{
        width: '100%',
        background: selected ? '#E1F5EE' : '#fff',
        border: `1.5px solid ${selected ? '#0F6E56' : '#D3D1C7'}`,
        borderRadius: '16px',
        padding: '13px 15px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: selected ? '#9FE1CB' : '#F1EFE8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: selected ? '#085041' : '#0F6E56',
        }}
      >
        <i className={`ti ${icon}`} style={{ fontSize: '16px' }} />
      </div>
      <div>
        <div
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '13px',
            fontWeight: 500,
            color: '#2C2C2A',
            marginBottom: detail ? '2px' : 0,
          }}
        >
          {label}
        </div>
        {detail && (
          <div
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '12px',
              color: '#888780',
              lineHeight: 1.4,
            }}
          >
            {detail}
          </div>
        )}
      </div>
    </button>
  )
}
