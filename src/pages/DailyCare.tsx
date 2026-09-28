import { useState, useEffect } from 'react'
import { getJSON, postJSON, getPersonId } from '../api/client'

interface Caregiver {
  id: string
  name: string
}

const MOOD_OPTIONS = ['Calm', 'Content', 'Anxious', 'Restless', 'Agitated', 'Aggressive', 'Confused', 'Other']
const AGITATION_OPTIONS = ['None', 'Mild', 'Moderate', 'Severe', 'Extreme']

export default function DailyCare() {
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [caregiverError, setCaregiverError] = useState<string | null>(null)

  const [form, setForm] = useState({
    mood: '',
    mood_scale: 3,
    agitation_level: 'None',
    agitation_scale: 1,
    vitals: {} as Record<string, string>,
    behavior_notes: '',
    sleep_notes: '',
    eating_notes: '',
    wellbeing_stress: 3,
    wellbeing_notes: '',
    general_notes: '',
  })

  const personId = getPersonId()
  const [caregiverId, setCaregiverId] = useState('')
  const [caregivers, setCaregivers] = useState<Caregiver[]>([])
  const [loadingCaregivers, setLoadingCaregivers] = useState(true)

  useEffect(() => {
    async function loadCaregivers() {
      try {
        const data = await getJSON(`/caregivers/${personId}`)
        setCaregivers(data)
        if (data.length > 0) setCaregiverId(data[0].id)
      } catch (e) {
        console.error(e)
        setCaregiverError('Could not load caregiver list. Using demo-default.')
        setCaregiverId('demo-caregiver')
      } finally {
        setLoadingCaregivers(false)
      }
    }
    loadCaregivers()
  }, [personId])

  const updateField = (field: string, value: any) => {
    setForm({ ...form, [field]: value })
    setSaved(false)
  }

  const addVital = () => {
    const key = prompt('Vital name (e.g. bp_systolic, heart_rate, oxygen_sat):')
    if (key) {
      const val = prompt(`Value for ${key}:`)
      if (val !== null) setForm({ ...form, vitals: { ...form.vitals, [key]: val } })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSaved(false)

    const caregiver = loadingCaregivers ? caregiverId : (caregiverId || 'demo-caregiver')

    try {
      await postJSON('/daily-care/entries', {
        person_id: personId,
        caregiver_id: caregiver,
        mood: form.mood || undefined,
        mood_scale: form.mood_scale !== 3 ? form.mood_scale : undefined,
        agitation_level: form.agitation_level,
        agitation_scale: form.agitation_scale !== 1 ? form.agitation_scale : undefined,
        vitals: Object.keys(form.vitals).length > 0 ? form.vitals : undefined,
        behavior_notes: form.behavior_notes || undefined,
        sleep_notes: form.sleep_notes || undefined,
        eating_notes: form.eating_notes || undefined,
        wellbeing_stress: form.wellbeing_stress !== 3 ? form.wellbeing_stress : undefined,
        wellbeing_notes: form.wellbeing_notes || undefined,
        general_notes: form.general_notes || undefined,
      })
      setSaved(true)
      setForm({
        mood: '',
        mood_scale: 3,
        agitation_level: 'None',
        agitation_scale: 1,
        vitals: {},
        behavior_notes: '',
        sleep_notes: '',
        eating_notes: '',
        wellbeing_stress: 3,
        wellbeing_notes: '',
        general_notes: '',
      })
    } catch (e: any) {
      setSaved(false)
      alert(`Failed to save: ${e.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '4px' }}>Daily care check-in</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
        Record today's observations. All entries are manual — no voice or camera required.
      </p>

      {saved && (
        <div style={{
          background: 'var(--trust-soft)', border: '1px solid var(--trust)',
          borderRadius: '12px', padding: '12px 16px', marginBottom: '20px'
        }}>
          <span style={{ fontSize: '13px', color: 'var(--trust)', fontWeight: 500 }}>
            Saved. {form.general_notes || 'Entry recorded.'}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Caregiver selector */}
        <section>
          <label style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block' }}>
            Recorded by
          </label>
          {loadingCaregivers ? (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading caregivers...</p>
          ) : (
            <select
              value={caregiverId}
              onChange={e => setCaregiverId(e.target.value)}
              required
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '8px',
                border: '1px solid var(--border)', background: 'var(--surface)',
                fontSize: '14px'
              }}
            >
              {caregivers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="demo-caregiver">Demo Caregiver</option>
            </select>
          )}
          {caregiverError && <p style={{ fontSize: '11px', color: 'var(--unknown)', marginTop: '4px' }}>{caregiverError}</p>}
        </section>

        {/* Mood */}
        <section>
          <label style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block' }}>
            Mood
          </label>
          <select
            value={form.mood}
            onChange={e => { updateField('mood', e.target.value); updateField('mood_scale', MOOD_OPTIONS.indexOf(e.target.value) + 1) }}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '14px' }}
          >
            <option value="">Select mood</option>
            {MOOD_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', display: 'block' }}>
            Mood scale: {form.mood_scale}/5
          </label>
        </section>

        {/* Agitation */}
        <section>
          <label style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block' }}>
            Agitation level
          </label>
          <select
            value={form.agitation_level}
            onChange={e => { updateField('agitation_level', e.target.value); updateField('agitation_scale', AGITATION_OPTIONS.indexOf(e.target.value) + 1) }}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '14px' }}
          >
            {AGITATION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </section>

        {/* Vitals */}
        <section>
          <label style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block' }}>
            Vitals (manual entry)
          </label>
          {Object.keys(form.vitals).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
              {Object.entries(form.vitals).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <code style={{ fontSize: '12px', background: 'var(--accent-soft)', padding: '4px 8px', borderRadius: '4px' }}>{k}</code>
                  <input
                    type="text" value={v}
                    onChange={e => updateField('vitals', { ...form.vitals, [k]: e.target.value })}
                    style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
                  />
                  <button type="button" onClick={() => { const nv = { ...form.vitals }; delete nv[k]; updateField('vitals', nv) }} style={{ fontSize: '11px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={addVital} style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>+ Add vital</button>
        </section>

        {/* Behavior */}
        <section>
          <label style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block' }}>
            Behavior notes
          </label>
          <textarea
            value={form.behavior_notes}
            onChange={e => updateField('behavior_notes', e.target.value)}
            placeholder="Any notable behavior or interaction today..."
            rows={3}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '14px', resize: 'vertical' }}
          />
        </section>

        {/* Sleep */}
        <section>
          <label style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block' }}>
            Sleep notes
          </label>
          <textarea
            value={form.sleep_notes}
            onChange={e => updateField('sleep_notes', e.target.value)}
            placeholder="Night rest, naps, sleep quality..."
            rows={2}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '14px', resize: 'vertical' }}
          />
        </section>

        {/* Eating */}
        <section>
          <label style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block' }}>
            Eating / appetite
          </label>
          <textarea
            value={form.eating_notes}
            onChange={e => updateField('eating_notes', e.target.value)}
            placeholder="Meals, appetite, fluid intake..."
            rows={2}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '14px', resize: 'vertical' }}
          />
        </section>

        {/* General */}
        <section>
          <label style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block' }}>
            General notes
          </label>
          <textarea
            value={form.general_notes}
            onChange={e => updateField('general_notes', e.target.value)}
            placeholder="Anything else worth noting..."
            rows={2}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '14px', resize: 'vertical' }}
          />
        </section>

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '12px 24px', borderRadius: '10px', border: 'none',
            background: submitting ? 'var(--text-secondary)' : 'var(--trust)',
            color: 'white', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
          }}
        >
          {submitting ? 'Saving...' : 'Save daily care entry'}
        </button>
      </form>
    </div>
  )
}
