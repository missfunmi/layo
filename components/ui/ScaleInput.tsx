'use client'

interface ScaleInputProps {
  value: number | null
  onChange: (value: number) => void
  labelLeft?: string
  labelRight?: string
}

export function ScaleInput({ value, onChange, labelLeft, labelRight }: ScaleInputProps) {
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const isSelected = value === n
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              style={{
                flex: 1,
                height: '54px',
                borderRadius: '13px',
                background: isSelected ? '#E1F5EE' : '#fff',
                border: `1.5px solid ${isSelected ? '#0F6E56' : '#D3D1C7'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '17px',
                fontWeight: 500,
                color: isSelected ? '#085041' : '#5F5E5A',
                cursor: 'pointer',
              }}
            >
              {n}
            </button>
          )
        })}
      </div>
      {(labelLeft || labelRight) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '11px',
            color: '#B4B2A9',
          }}
        >
          <span>{labelLeft}</span>
          <span>{labelRight}</span>
        </div>
      )}
    </div>
  )
}
