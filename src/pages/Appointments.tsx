import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJSON, getPersonId, postJSON } from '../api/client'

interface Caregiver { id: string; name: string; person_id: string }
interface Appointment {
  id: string; person_id: string; title: string; scheduled_at: string
  scheduled_at_timezone?: string | null; location?: string | null; provider?: string | null
  healthcare_org?: string | null; preparation_notes?: string | null
  documents_to_bring?: string[] | null; medication_questions?: string[] | null
  travel_notes?: string | null; status: string; created_by_caregiver_id: string
}

const inputStyle = { width: '100%', boxSizing: 'border-box' as const, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }

function displayDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export default function Appointments() {
  const personId = getPersonId()
  const [caregivers, setCaregivers] = useState<Caregiver[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [caregiverId, setCaregiverId] = useState('')
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  const [location, setLocation] = useState('')
  const [provider, setProvider] = useState('')
  const [preparationNotes, setPreparationNotes] = useState('')
  const [documents, setDocuments] = useState('')
  const [medicationQuestions, setMedicationQuestions] = useState('')
  const [travelNotes, setTravelNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function load() {
    if (!personId) {
      setAppointments([]); setCaregivers([])
      setError('Select a care recipient before managing appointments.')
      return
    }
    setLoading(true); setError(null)
    const results = await Promise.allSettled([
      getJSON('/appointments/' + encodeURIComponent(personId)),
      getJSON('/caregivers/' + encodeURIComponent(personId)),
    ])
    if (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) setAppointments(results[0].value as Appointment[])
    else { setAppointments([]); setError('Appointments could not be retrieved from the backend.') }
    if (results[1].status === 'fulfilled' && Array.isArray(results[1].value)) {
      const list = results[1].value as Caregiver[]
      setCaregivers(list)
      setCaregiverId(current => list.some(c => c.id === current) ? current : list[0]?.id || '')
    } else {
      setCaregivers([])
      setError(current => [current, 'Linked caregivers could not be retrieved; appointment creation is disabled.'].filter(Boolean).join(' '))
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [personId])

  async function createAppointment(event: FormEvent) {
    event.preventDefault()
    if (!personId || !caregiverId || !caregivers.some(c => c.id === caregiverId)) {
      setError('Choose a real linked caregiver before saving this appointment.')
      return
    }
    if (!title.trim() || !scheduledAt) {
      setError('Appointment title and date/time are required.')
      return
    }
    setSaving(true); setError(null); setNotice(null)
    try {
      const result = await postJSON<Appointment>('/appointments', {
        person_id: personId,
        title: title.trim(),
        scheduled_at: new Date(scheduledAt).toISOString(),
        scheduled_at_timezone: timezone || 'UTC',
        location: location.trim() || undefined,
        provider: provider.trim() || undefined,
        preparation_notes: preparationNotes.trim() || undefined,
        documents_to_bring: documents.split('\n').map(x => x.trim()).filter(Boolean),
        medication_questions: medicationQuestions.split('\n').map(x => x.trim()).filter(Boolean),
        travel_notes: travelNotes.trim() || undefined,
        status: 'scheduled',
        time_provenance: 'caregiver_recorded',
        location_provenance: location.trim() ? 'caregiver_recorded' : undefined,
        created_by_caregiver_id: caregiverId,
      })
      if (!result || !result.id || result.person_id !== personId || result.created_by_caregiver_id !== caregiverId) {
        throw new Error('The server did not confirm the appointment for the selected person and caregiver. Refresh the list before retrying.')
      }
      setTitle(''); setScheduledAt(''); setLocation(''); setProvider('')
      setPreparationNotes(''); setDocuments(''); setMedicationQuestions(''); setTravelNotes('')
      setNotice('Appointment saved and confirmed by the backend.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Appointment save could not be confirmed. Refresh the list before retrying.')
    } finally { setSaving(false) }
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div><h1 style={{ fontSize: 24, fontWeight: 600 }}>Appointments</h1><p style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 13 }}>Appointment details, preparation notes, questions, documents, and travel context for the selected care recipient.</p></div>
        <button onClick={() => void load()} disabled={loading} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      <nav style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 13 }}><Link to="/">Care overview</Link><Link to="/daily-care">Daily Care</Link><Link to="/care-circle">Care coordination</Link></nav>
      {error && <p role="alert" style={{ marginTop: 16, color: 'var(--error)', fontSize: 13 }}>{error}</p>}
      {notice && <p role="status" style={{ marginTop: 16, color: 'var(--trust)', fontSize: 13 }}>{notice}</p>}
      {!personId && <p style={{ marginTop: 18 }}>Select a care recipient first. No demo person is substituted.</p>}
      <section style={{ marginTop: 20, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Record an appointment</h2>
        <form onSubmit={createAppointment} style={{ display: 'grid', gap: 12, marginTop: 14 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Appointment title<input required value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="e.g. Neurology follow-up" /></label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Date and time<input required type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} style={inputStyle} /></label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Time zone<input value={timezone} onChange={e => setTimezone(e.target.value)} required style={inputStyle} /></label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Recorded by<select required value={caregiverId} onChange={e => setCaregiverId(e.target.value)} disabled={!caregivers.length} style={inputStyle}><option value="">Select linked caregiver</option>{caregivers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Provider<input value={provider} onChange={e => setProvider(e.target.value)} style={inputStyle} /></label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Location<input value={location} onChange={e => setLocation(e.target.value)} style={inputStyle} /></label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Preparation notes<textarea rows={3} value={preparationNotes} onChange={e => setPreparationNotes(e.target.value)} style={inputStyle} /></label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Documents to bring (one per line)<textarea rows={2} value={documents} onChange={e => setDocuments(e.target.value)} style={inputStyle} /></label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Medication questions (one per line)<textarea rows={2} value={medicationQuestions} onChange={e => setMedicationQuestions(e.target.value)} style={inputStyle} /></label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Travel notes<textarea rows={2} value={travelNotes} onChange={e => setTravelNotes(e.target.value)} style={inputStyle} /></label>
          <button type="submit" disabled={saving || loading || !personId || !caregivers.length} style={{ justifySelf: 'start', padding: '10px 14px', border: 0, borderRadius: 8, background: 'var(--trust)', color: 'white' }}>{saving ? 'Saving…' : 'Save appointment'}</button>
        </form>
      </section>
      <section style={{ marginTop: 20, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Saved appointments ({appointments.length})</h2>
        {loading ? <p style={{ marginTop: 10, color: 'var(--text-secondary)' }}>Loading appointments…</p> : appointments.length === 0 ? <p style={{ marginTop: 10, color: 'var(--text-secondary)', fontSize: 13 }}>No appointments returned by the backend.</p> : <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>{appointments.map(a => <article key={a.id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><strong>{a.title}</strong><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.status}</span></div>
          <p style={{ marginTop: 6, fontSize: 13 }}>{displayDate(a.scheduled_at)}{a.scheduled_at_timezone ? ' · ' + a.scheduled_at_timezone : ''}</p>
          {(a.provider || a.location) && <p style={{ marginTop: 4, fontSize: 13, color: 'var(--text-secondary)' }}>{[a.provider, a.location].filter(Boolean).join(' · ')}</p>}
          {a.preparation_notes && <p style={{ marginTop: 8, fontSize: 13 }}>Preparation: {a.preparation_notes}</p>}
          {a.documents_to_bring?.length ? <p style={{ marginTop: 6, fontSize: 13 }}>Bring: {a.documents_to_bring.join(', ')}</p> : null}
          {a.medication_questions?.length ? <p style={{ marginTop: 6, fontSize: 13 }}>Questions: {a.medication_questions.join('; ')}</p> : null}
          {a.travel_notes && <p style={{ marginTop: 6, fontSize: 13 }}>Travel: {a.travel_notes}</p>}
        </article>)}</div>}
      </section>
    </main>
  )
}
