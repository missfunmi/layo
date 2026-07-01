'use client'

interface ProgressDotsProps {
  total: number
  active: number
}

export function ProgressDots({ total, active }: ProgressDotsProps) {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === active ? '18px' : '6px',
            height: '6px',
            borderRadius: i === active ? '3px' : '50%',
            background: i === active ? '#0F6E56' : '#D3D1C7',
            transition: 'width 0.2s, border-radius 0.2s',
          }}
        />
      ))}
    </div>
  )
}
