import { FormEvent, useEffect, useState } from 'react'
import { getJSON, postJSON, getPersonId } from '../api/client'

interface Caregiver { id: string; name: string; relationship?: string; person_id?: string }
interface Responsibility {
  id: string; caregiver_id: string; person_id: string; responsibility_type: string
  scope?: string | null; status: string; acceptance_status: string; effective_start: string
}
interface Handoff {
  id: string; from_caregiver_id: string; to_caregiver_id: string; person_id: string
  responsibility_type: string; scope?: string | null; effective_time?: string | null
  context?: string | null; acceptance_status: string; acceptance_evidence?: string | null
  is_completed: boolean; timestamp: string
}

export default function CareCircle() {
  const personId = getPersonId()
  const [caregivers, setCaregivers] = useState<Caregiver[]>([])
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([])
  const [handoffs, setHandoffs] = useState<Handoff[]>([])
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [responsibilityType, setResponsibilityType] = useState('')
  const [scope, setScope] = useState('')
  const [context, setContext] = useState('')
  const [acceptanceEvidence, setAcceptanceEvidence] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function load() {
    if (!personId) {
      setCaregivers([]); setResponsibilities([]); setHandoffs([])
      setError('Select a care recipient before managing care coordination.')
      return
    }
    setLoading(true); setError(null); setNotice(null)
    const results = await Promise.allSettled([
      getJSON('/caregivers/' + encodeURIComponent(personId)),
      getJSON('/caregiver-responsibilities/' + encodeURIComponent(personId)),
      getJSON('/caregiver-handoffs/' + encodeURIComponent(personId)),
    ])
    const labels = ['linked caregivers', 'responsibilities', 'handoffs']
    const errors = results.flatMap((result, i) => result.status === 'rejected' ? [labels[i]] : [])
    setCaregivers(results[0].status === 'fulfilled' && Array.isArray(results[0].value) ? results[0].value as Caregiver[] : [])
    setResponsibilities(results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value as Responsibility[] : [])
    setHandoffs(results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value as Handoff[] : [])
    if (errors.length) setError('Could not load: ' + errors.join(', ') + '. Only successfully retrieved backend records are shown.')
    const validCaregivers = results[0].status === 'fulfilled' && Array.isArray(results[0].value) ? results[0].value as Caregiver[] : []
    setFromId(current => validCaregivers.some(c => c.id === current) ? current : validCaregivers[0]?.id || '')
    setToId(current => validCaregivers.some(c => c.id === current) ? current : validCaregivers.find(c => c.id !== validCaregivers[0]?.id)?.id || '')
    setLoading(false)
  }

  useEffect(() => { void load() }, [personId])

  async function createHandoff(event: FormEvent) {
    event.preventDefault()
    if (!personId || !fromId || !toId || fromId === toId || !responsibilityType.trim()) {
      setError('Select two different linked caregivers and enter the responsibility being handed off.')
      return
    }
    setSaving(true); setError(null); setNotice(null)
    try {
      const result = await postJSON<Handoff>('/caregiver-handoffs', {
        person_id: personId,
        from_caregiver_id: fromId,
        to_caregiver_id: toId,
        responsibility_type: responsibilityType.trim(),
        scope: scope.trim() || undefined,
        context: context.trim() || undefined,
        provenance: 'caregiver_recorded',
      })
      if (!result || typeof result.id !== 'string' || !result.id || result.person_id !== personId) {
        throw new Error('The server did not confirm this handoff. Refresh the handoff list before retrying.')
      }
      setResponsibilityType(''); setScope(''); setContext('')
      setNotice('Handoff recorded. It remains unconfirmed until the receiving caregiver accepts it.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Handoff could not be confirmed. Refresh before retrying.')
    } finally { setSaving(false) }
  }

  async function acceptHandoff(handoff: Handoff) {
    const evidence = (acceptanceEvidence[handoff.id] || '').trim()
    if (!evidence) {
      setError('Enter acceptance evidence before acknowledging the handoff.')
      return
    }
    setError(null); setNotice(null)
    try {
      await postJSON('/caregiver-handoffs/' + encodeURIComponent(handoff.id) + '/accept?acceptance_evidence=' + encodeURIComponent(evidence), {})
      setNotice('Acceptance submitted. Refreshing handoffs from the backend.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Acceptance could not be confirmed.')
    }
  }

  const caregiverName = (id: string) => caregivers.find(c => c.id === id)?.name || 'Unknown linked caregiver'

  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>Care Coordination</h1>
          <p style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 13 }}>Linked caregivers, recorded responsibilities, and explicit handoff acceptance for the selected care recipient.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      {error && <p role="alert" style={{ marginTop: 16, color: 'var(--error)', fontSize: 13 }}>{error}</p>}
      {notice && <p role="status" style={{ marginTop: 16, color: 'var(--trust)', fontSize: 13 }}>{notice}</p>}
      {!personId && <p style={{ marginTop: 20 }}>Select a care recipient first. No demo person is substituted.</p>}
      {loading && <p style={{ marginTop: 20, color: 'var(--text-secondary)' }}>Loading coordination records…</p>}
      {!loading && personId && <>
        <section style={{ marginTop: 20, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Linked caregivers ({caregivers.length})</h2>
          {caregivers.length === 0 ? <p style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 13 }}>No linked caregivers returned. Handoffs require real linked caregiver records.</p> : <ul style={{ marginTop: 10, paddingLeft: 20 }}>{caregivers.map(c => <li key={c.id} style={{ marginBottom: 6 }}>{c.name}{c.relationship ? ' · ' + c.relationship : ''}</li>)}</ul>}
        </section>

        <section style={{ marginTop: 20, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Record a care handoff</h2>
          <p style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 13 }}>A handoff is not complete until the receiving caregiver acknowledges it.</p>
          <form onSubmit={createHandoff} style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>From caregiver
              <select required value={fromId} onChange={e => setFromId(e.target.value)} disabled={caregivers.length < 2} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                <option value="">Select caregiver</option>{caregivers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Receiving caregiver
              <select required value={toId} onChange={e => setToId(e.target.value)} disabled={caregivers.length < 2} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                <option value="">Select caregiver</option>{caregivers.filter(c => c.id !== fromId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Responsibility being handed off
              <input required value={responsibilityType} onChange={e => setResponsibilityType(e.target.value)} placeholder="e.g. evening routine, appointment transport" style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }} />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Scope (optional)
              <input value={scope} onChange={e => setScope(e.target.value)} placeholder="Specific tasks or boundaries" style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }} />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Context (optional)
              <textarea value={context} onChange={e => setContext(e.target.value)} rows={3} placeholder="Relevant facts for the receiving caregiver" style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }} />
            </label>
            <button type="submit" disabled={saving || caregivers.length < 2} style={{ justifySelf: 'start', padding: '10px 14px', border: 0, borderRadius: 8, background: 'var(--trust)', color: 'white' }}>{saving ? 'Saving…' : 'Record handoff'}</button>
            {caregivers.length < 2 && <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>At least two linked caregivers are required. The UI will not invent caregiver identities.</p>}
          </form>
        </section>

        <section style={{ marginTop: 20, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Current responsibilities ({responsibilities.length})</h2>
          {responsibilities.length === 0 ? <p style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 13 }}>No responsibilities returned by the backend.</p> : <ul style={{ marginTop: 10, paddingLeft: 20 }}>{responsibilities.map(r => <li key={r.id} style={{ marginBottom: 8 }}>{r.responsibility_type} — {caregiverName(r.caregiver_id)} · {r.status} · acceptance: {r.acceptance_status}{r.scope ? ' · ' + r.scope : ''}</li>)}</ul>}
        </section>

        <section style={{ marginTop: 20, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Handoff history ({handoffs.length})</h2>
          {handoffs.length === 0 ? <p style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 13 }}>No handoffs returned by the backend.</p> : <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>{handoffs.map(h => <article key={h.id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
            <div style={{ fontWeight: 600 }}>{h.responsibility_type}</div>
            <p style={{ marginTop: 5, fontSize: 13 }}>{caregiverName(h.from_caregiver_id)} → {caregiverName(h.to_caregiver_id)}</p>
            {h.scope && <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-secondary)' }}>{h.scope}</p>}
            {h.context && <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-secondary)' }}>{h.context}</p>}
            <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>Status: {h.acceptance_status}{h.is_completed ? ' · completed' : ''}</p>
            {h.acceptance_status.toLowerCase() !== 'accepted' && !h.is_completed && <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <input value={acceptanceEvidence[h.id] || ''} onChange={e => setAcceptanceEvidence(prev => ({ ...prev, [h.id]: e.target.value }))} placeholder="Acceptance evidence" style={{ flex: 1, minWidth: 180, padding: 8, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }} />
              <button type="button" onClick={() => void acceptHandoff(h)} style={{ padding: '8px 12px', borderRadius: 8, border: 0, background: 'var(--trust)', color: 'white' }}>Acknowledge</button>
            </div>}
          </article>)}</div>}
        </section>
      </>}
    </main>
  )
}
