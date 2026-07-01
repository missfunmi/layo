'use client'

interface SingleSelectProps {
  options: string[]
  selected: string | null
  onChange: (selected: string) => void
}

export function SingleSelect({ options, selected, onChange }: SingleSelectProps) {
  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      {options.map((option) => {
        const isSelected = selected === option
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            style={{
              flex: 1,
              padding: '14px 12px',
              borderRadius: '14px',
              border: `1.5px solid ${isSelected ? '#0F6E56' : '#D3D1C7'}`,
              background: isSelected ? '#E1F5EE' : '#fff',
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '13px',
              fontWeight: 500,
              color: isSelected ? '#085041' : '#2C2C2A',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
