import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJSON, getPersonId, subscribeToPersonId } from '../api/client'

interface Evidence {
  id: string
  type: string
  source_text: string
  uploaded_at: string
  time_provenance?: string
  location?: string
}

function requireEvidenceArray(value: unknown): Evidence[] {
  if (!Array.isArray(value)) {
    throw new Error('The server returned an invalid Living Care Record response. No empty state has been assumed.')
  }
  return value as Evidence[]
}

export default function Record() {
  const [personId, setPersonIdState] = useState(getPersonId())
  const [items, setItems] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)

  useEffect(() => subscribeToPersonId(setPersonIdState), [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError(null)
      setItems([])

      if (!personId.trim()) {
        setLoadError('Select an authorized care record to view its evidence.')
        setLoading(false)
        return
      }

      try {
        const data = await getJSON<unknown>(`/evidence/${encodeURIComponent(personId)}`)
        const nextItems = requireEvidenceArray(data)
        if (!cancelled) setItems(nextItems)
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'The Living Care Record could not be loaded. Its contents are unknown.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [personId, reloadVersion])

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
            Evidence saved to the selected care record.
          </p>
        </div>
        <div>
          <Link to="/daily-care" style={{ fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none', marginRight: '16px' }}>← Daily notes</Link>
          <Link to="/structured-daily-capture" style={{ fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none' }}>← Structured capture</Link>
        </div>
      </div>

      {loading && <p role="status" style={{ color: 'var(--text-secondary)' }}>Loading Living Care Record…</p>}
      {!loading && loadError && (
        <section role="alert" style={{ border: '1px solid var(--error)', borderRadius: 10, padding: 16, color: 'var(--error)' }}>
          <strong>Living Care Record could not be confirmed.</strong>
          <p style={{ marginTop: 8 }}>{loadError}</p>
          <button type="button" onClick={() => setReloadVersion(version => version + 1)} style={{ marginTop: 10 }}>Retry</button>
        </section>
      )}

      {!loading && !loadError && items.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No evidence is recorded for this care record.</p>
      )}

      {!loading && !loadError && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map(item => (
            <div key={item.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '16px' }}>{typeIcon[item.type] || '📎'}</span>
                <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{item.type}</span>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(item.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
              <p style={{ fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.source_text}</p>
              {item.time_provenance && <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', fontStyle: 'italic' }}>Time source: {item.time_provenance}</p>}
              {item.location && <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Location: {item.location}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
