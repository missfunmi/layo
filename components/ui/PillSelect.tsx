'use client'

interface PillSelectProps {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function PillSelect({ options, selected, onChange }: PillSelectProps) {
  function toggle(option: string) {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option))
    } else {
      onChange([...selected, option])
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {options.map((option) => {
        const isSelected = selected.includes(option)
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '13px',
              fontWeight: 500,
              padding: '9px 16px',
              borderRadius: '100px',
              border: `1.5px solid ${isSelected ? '#0F6E56' : '#D3D1C7'}`,
              background: isSelected ? '#E1F5EE' : '#fff',
              color: isSelected ? '#085041' : '#5F5E5A',
              cursor: 'pointer',
            }}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
