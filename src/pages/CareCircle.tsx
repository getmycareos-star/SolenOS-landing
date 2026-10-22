import { FormEvent, useEffect, useState } from 'react'
import { getJSON, postJSON, getPersonId, getCaregiverId } from '../api/client'

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

function isCaregiverRecord(value: unknown): value is Caregiver {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && Boolean(item.id) && typeof item.name === 'string'
}
function isResponsibility(value: unknown): value is Responsibility {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && typeof item.caregiver_id === 'string' &&
    typeof item.person_id === 'string' && typeof item.responsibility_type === 'string' &&
    typeof item.status === 'string' && typeof item.acceptance_status === 'string' &&
    typeof item.effective_start === 'string'
}
function isHandoff(value: unknown): value is Handoff {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && typeof item.from_caregiver_id === 'string' &&
    typeof item.to_caregiver_id === 'string' && typeof item.person_id === 'string' &&
    typeof item.responsibility_type === 'string' && typeof item.acceptance_status === 'string' &&
    typeof item.is_completed === 'boolean' && typeof item.timestamp === 'string'
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
  const [loadErrors, setLoadErrors] = useState<{ caregivers: string | null; responsibilities: string | null; handoffs: string | null }>({ caregivers: null, responsibilities: null, handoffs: null })
  const [notice, setNotice] = useState<string | null>(null)
  const [professionalId, setProfessionalId] = useState('')
  const [organization, setOrganization] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    setNotice(null)
    setCaregivers([])
    setResponsibilities([])
    setHandoffs([])
    setLoadErrors({ caregivers: null, responsibilities: null, handoffs: null })

    if (!personId) {
      const message = 'Select a care recipient before loading coordination records.'
      setLoadErrors({ caregivers: message, responsibilities: message, handoffs: message })
      setError(message)
      setLoading(false)
      return
    }

    const results = await Promise.allSettled([
      getJSON<unknown>('/caregivers/' + encodeURIComponent(personId)),
      getJSON<unknown>('/caregiver-responsibilities/' + encodeURIComponent(personId)),
      getJSON<unknown>('/caregiver-handoffs/' + encodeURIComponent(personId)),
    ])
    const names = ['linked caregivers', 'responsibilities', 'handoffs']
    const validators = [isCaregiverRecord, isResponsibility, isHandoff]
    const arrays = results.map((result, index) =>
      result.status === 'fulfilled' && Array.isArray(result.value) && result.value.every(validators[index])
        ? result.value
        : null
    )
    const nextErrors = {
      caregivers: arrays[0] ? null : `Linked caregivers could not be verified. ${results[0].status === 'rejected' && results[0].reason instanceof Error ? results[0].reason.message : 'The server returned an invalid response.'}`,
      responsibilities: arrays[1] ? null : `Responsibilities could not be verified. ${results[1].status === 'rejected' && results[1].reason instanceof Error ? results[1].reason.message : 'The server returned an invalid response.'}`,
      handoffs: arrays[2] ? null : `Handoffs could not be verified. ${results[2].status === 'rejected' && results[2].reason instanceof Error ? results[2].reason.message : 'The server returned an invalid response.'}`,
    }
    const nextCaregivers = (arrays[0] || []) as Caregiver[]
    setCaregivers(nextCaregivers)
    setResponsibilities((arrays[1] || []) as Responsibility[])
    setHandoffs((arrays[2] || []) as Handoff[])
    setLoadErrors(nextErrors)
    const failed = names.filter((_, index) => arrays[index] === null)
    if (failed.length) setError(`Could not verify ${failed.join(', ')}. Affected sections are marked unavailable, not empty.`)
    setFromId(current => nextCaregivers.some(c => c.id === current) ? current : nextCaregivers[0]?.id || '')
    setToId(current => nextCaregivers.some(c => c.id === current) ? current : nextCaregivers.find(c => c.id !== nextCaregivers[0]?.id)?.id || '')
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


  async function grantProfessionalAccess(event: FormEvent) {
    event.preventDefault()
    const caregiverId = getCaregiverId()
    if (!personId || !caregiverId || !professionalId.trim()) {
      setError('A selected care recipient and professional caregiver ID are required.')
      return
    }
    setError(null); setNotice(null); setSaving(true)
    try {
      const result = await postJSON<{ id: string; status: string }>('/professional/access-grants', {
        professional_caregiver_id: professionalId.trim(),
        person_id: personId,
        granted_by_caregiver_id: caregiverId,
        organization: organization.trim() || undefined,
        status: 'active',
      })
      if (!result.id || result.status !== 'active') throw new Error('The backend did not confirm the access grant.')
      setNotice('Professional access grant saved. The professional must sign in with their provisioned professional account.')
      setProfessionalId(''); setOrganization('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Professional access could not be confirmed.')
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
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{loadErrors.caregivers ? 'Linked caregivers' : `Linked caregivers (${caregivers.length})`}</h2>
          {loadErrors.caregivers ? <p role="alert" style={{ marginTop: 8, color: 'var(--error)', fontSize: 13 }}>{loadErrors.caregivers}</p> : caregivers.length === 0 ? <p style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 13 }}>No linked caregivers returned. Handoffs require real linked caregiver records.</p> : <ul style={{ marginTop: 10, paddingLeft: 20 }}>{caregivers.map(c => <li key={c.id} style={{ marginBottom: 6 }}>{c.name}{c.relationship ? ' · ' + c.relationship : ''}</li>)}</ul>}
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
              <input required value={responsibilityType} onChange={e => setResponsibilityType(e.target.value)} placeholder="Describe the responsibility being handed off" style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }} />
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
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{loadErrors.responsibilities ? 'Current responsibilities' : `Current responsibilities (${responsibilities.length})`}</h2>
          {loadErrors.responsibilities ? <p role="alert" style={{ marginTop: 8, color: 'var(--error)', fontSize: 13 }}>{loadErrors.responsibilities}</p> : responsibilities.length === 0 ? <p style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 13 }}>No responsibilities returned by the backend.</p> : <ul style={{ marginTop: 10, paddingLeft: 20 }}>{responsibilities.map(r => <li key={r.id} style={{ marginBottom: 8 }}>{r.responsibility_type} — {caregiverName(r.caregiver_id)} · {r.status} · acceptance: {r.acceptance_status}{r.scope ? ' · ' + r.scope : ''}</li>)}</ul>}
        </section>


        <section style={{ marginTop: 20, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Grant professional access</h2>
          <p style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 13 }}>Grant a provisioned professional account access to this selected care record. Use the professional's caregiver record ID; do not share passwords or admin keys.</p>
          <form onSubmit={grantProfessionalAccess} style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Professional caregiver record ID
              <input required value={professionalId} onChange={e => setProfessionalId(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }} />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Organization (optional)
              <input value={organization} onChange={e => setOrganization(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }} />
            </label>
            <button type="submit" disabled={saving || !personId} style={{ justifySelf: 'start', padding: '10px 14px', border: 0, borderRadius: 8, background: 'var(--trust)', color: 'white' }}>{saving ? 'Saving…' : 'Grant access'}</button>
          </form>
        </section>

        <section style={{ marginTop: 20, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{loadErrors.handoffs ? 'Handoff history' : `Handoff history (${handoffs.length})`}</h2>
          {loadErrors.handoffs ? <p role="alert" style={{ marginTop: 8, color: 'var(--error)', fontSize: 13 }}>{loadErrors.handoffs}</p> : handoffs.length === 0 ? <p style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 13 }}>No handoffs returned by the backend.</p> : <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>{handoffs.map(h => <article key={h.id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
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
