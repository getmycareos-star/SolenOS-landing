import { useState, useEffect } from 'react'
import { getPersonId, setPersonId, subscribeToPersonId } from '../api/client'

export default function PersonSelector() {
  const [personId, setPersonIdState] = useState(getPersonId())

  useEffect(() => {
    return subscribeToPersonId(setPersonIdState)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value || 'demo-person-id'
    setPersonIdState(value)
    setPersonId(value)
  }

  const isDemo = personId === 'demo-person-id'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      background: isDemo ? 'var(--unknown-soft)' : 'var(--trust-soft)',
      border: `1px solid ${isDemo ? 'var(--unknown)' : 'var(--trust)'}`,
      borderRadius: '8px', padding: '6px 12px'
    }}>
      <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: isDemo ? 'var(--unknown)' : 'var(--trust)' }}>
        Person:
      </span>
      <input
        type="text"
        value={personId}
        onChange={handleChange}
        placeholder="person-id"
        style={{
          fontSize: '13px', background: 'transparent', border: 'none', outline: 'none',
          width: '160px', color: isDemo ? 'var(--unknown)' : 'var(--trust)',
        }}
      />
      {isDemo && (
        <span style={{ fontSize: '10px', color: 'var(--unknown)', fontStyle: 'italic' }}>demo</span>
      )}
    </div>
  )
}
