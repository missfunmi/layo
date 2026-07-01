'use client'

interface PickerFieldProps {
  value: string
  onClick: () => void
  placeholder?: string
}

export function PickerField({ value, onClick, placeholder }: PickerFieldProps) {
  const isFilled = value.length > 0

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        background: '#fff',
        border: '1.5px solid #0F6E56',
        borderRadius: '14px',
        padding: '13px 15px',
        fontFamily: 'var(--font-inter), sans-serif',
        fontSize: '14px',
        color: isFilled ? '#2C2C2A' : '#B4B2A9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        textAlign: 'left',
        boxSizing: 'border-box',
      }}
    >
      <span>{isFilled ? value : placeholder}</span>
      <i className="ti ti-chevron-down" style={{ fontSize: '16px', color: '#B4B2A9', flexShrink: 0 }} />
    </button>
  )
}
