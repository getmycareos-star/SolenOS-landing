import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '4px' }}>Living Care Record</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5, maxWidth: '500px' }}>
            Upload documents, notes, photos, messages, and care information. SolenOS remembers and connects these over time.
          </p>
        </div>
        <Link to="/daily-care" style={{ fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
          ← Daily capture
        </Link>
      </div>

      <div style={{
        background: 'var(--accent-soft)', border: '1px solid var(--accent)',
        borderRadius: '8px', padding: '8px 14px', marginBottom: '16px'
      }}>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
          Changes recorded in "What Matters Today" automatically become part of the Living Care Record.
        </p>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.8 }}>
          Not sure where something belongs? Add it anywhere. SolenOS will organize it.
        </p>
      </div>

      <div style={{
        display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px',
        padding: '8px 12px', background: 'var(--bg)', borderRadius: '8px', border: '1px dashed var(--border)'
      }}>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Examples:</span>
        {['Doctor\'s note', 'Hospital discharge paper', 'Medication list', 'Family message', 'Photo of document'].map(ex => (
          <span key={ex} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>• {ex}</span>
        ))}
      </div>

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
