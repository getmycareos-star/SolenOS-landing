import { useState, useEffect } from 'react'
import { getPersonId, subscribeToPersonId } from '../api/client'

export default function PersonSelector() {
  const [personId, setPersonIdState] = useState(getPersonId())

  useEffect(() => subscribeToPersonId(setPersonIdState), [])

  return (
    <div
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '6px 12px',
      }}
    >
      <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
        Care record:
      </span>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        {personId ? personId : 'No authorized care record selected'}
      </span>
    </div>
  )
}
