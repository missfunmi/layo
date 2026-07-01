'use client'

interface YesNoSelectorProps {
  value: boolean | null
  onChange: (value: boolean) => void
}

export function YesNoSelector({ value, onChange }: YesNoSelectorProps) {
  const options: { label: string; val: boolean }[] = [
    { label: 'Yes', val: true },
    { label: 'No', val: false },
  ]

  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      {options.map(({ label, val }) => {
        const isSelected = value === val
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(val)}
            style={{
              flex: 1,
              padding: '16px',
              borderRadius: '14px',
              border: `1.5px solid ${isSelected ? '#0F6E56' : '#D3D1C7'}`,
              background: isSelected ? '#E1F5EE' : '#fff',
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '14px',
              fontWeight: 500,
              color: isSelected ? '#085041' : '#2C2C2A',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
