import { useEffect, useState } from 'react'
import { getJSON } from '../api/client'

interface Evidence {
  id: string
  type: string
  source_text: string
  uploaded_at: string
  time_provenance?: string
  location?: string
}

export default function Record() {
  const [items, setItems] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await getJSON('/evidence/demo-person-id')
        setItems(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const typeIcon: Record<string, string> = {
    document: '📄',
    note: '📝',
    conversation: '💬',
    observation: '👁️',
  }

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '4px' }}>What should I remember</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
        The original record. Nothing is replaced. Everything is preserved.
      </p>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>}

      {!loading && items.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No evidence recorded yet.</p>
      )}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map(item => (
            <div key={item.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '16px 20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '16px' }}>{typeIcon[item.type] || '📎'}</span>
                <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
                  {item.type}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {new Date(item.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p style={{ fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.source_text}</p>
              {item.time_provenance && (
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', fontStyle: 'italic' }}>
                  Time source: {item.time_provenance}
                </p>
              )}
              {item.location && (
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Location: {item.location}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
