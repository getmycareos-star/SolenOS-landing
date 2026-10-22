import { useState, useEffect } from 'react'
import { getPersonId, setPersonId, subscribeToPersonId } from '../api/client'

export default function PersonSelector() {
  const [personId, setPersonIdState] = useState(getPersonId())

  useEffect(() => subscribeToPersonId(setPersonIdState), [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim()
    setPersonIdState(value)
    setPersonId(value)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '8px', padding: '6px 12px'
    }}>
      <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
        Care record ID:
      </span>
      <input
        type="text"
        value={personId}
        onChange={handleChange}
        placeholder="Select a care record"
        aria-label="Selected care record ID"
        style={{
          fontSize: '13px', background: 'transparent', border: 'none', outline: 'none',
          width: '180px', color: 'var(--text)',
        }}
      />
      {!personId && <span role="status" style={{ fontSize: '10px', color: 'var(--unknown)' }}>No record selected</span>}
    </div>
  )
}
