import { useState, useEffect } from 'react'
import { getJSON, postJSON, getPersonId } from '../api/client'
import CareCapture from '../components/CareCapture'
import { useLocationPermission } from '../lib/permissions/useLocationPermission'

interface Caregiver {
  id: string
  name: string
}

const MOOD_OPTIONS = ['Calm', 'Content', 'Anxious', 'Restless', 'Agitated', 'Aggressive', 'Confused', 'Other']
const AGITATION_OPTIONS = ['None', 'Mild', 'Moderate', 'Severe', 'Extreme']
const VITAL_TYPES = ['bp_systolic', 'bp_diastolic', 'heart_rate', 'oxygen_sat', 'temperature', 'weight']

export default function DailyCare() {
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [caregiverError, setCaregiverError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

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
     location: null as { latitude: number; longitude: number; accuracy: number; timestamp: number } | null,
   })

  const personId = getPersonId()
  const [caregiverId, setCaregiverId] = useState('')
  const [caregivers, setCaregivers] = useState<Caregiver[]>([])
  const [loadingCaregivers, setLoadingCaregivers] = useState(true)

  useEffect(() => {
    async function loadCaregivers() {
      if (!personId) {
        setCaregivers([])
        setCaregiverId('')
        setCaregiverError('Sign in and select an authorized care record first.')
        setLoadingCaregivers(false)
        return
      }

      try {
        const data = await getJSON(`/caregivers/${personId}`)
        if (!Array.isArray(data)) throw new Error('Unexpected caregiver response.')
        setCaregivers(data)
        if (data.length > 0) {
          setCaregiverId(data[0].id)
          setCaregiverError(null)
        } else {
          setCaregiverId('')
          setCaregiverError('No caregiver is linked to this care record. Link a caregiver before saving.')
        }
      } catch (error) {
        console.error('Could not load caregivers:', error)
        setCaregivers([])
        setCaregiverId('')
        setCaregiverError('Could not load caregivers. Check sign-in and care-record access.')
      } finally {
        setLoadingCaregivers(false)
      }
    }
    void loadCaregivers()
  }, [personId])

   const updateField = (field: string, value: any) => {
     setForm(prev => ({ ...prev, [field]: value }))
     setSaved(false)
   }

   // Location permission hook
   const { state: locationState, requestLocation: requestLoc } = useLocationPermission();

   // Update form with location data when permission is granted
   useEffect(() => {
     if (locationState.status === 'granted') {
       const { latitude, longitude, accuracy, timestamp } = locationState;
       setForm(prev => ({ ...prev, location: { latitude, longitude, accuracy, timestamp } }));
       setSaved(false);
     }
   }, [locationState]);

   const handleLocationRequest = async () => {
     await requestLoc();
   };

   const addVital = () => {
     setFormError(null)
     const keyInput = prompt(`Vital type (${VITAL_TYPES.join(', ')}):`)
     if (!keyInput) return
     const key = keyInput.trim().toLowerCase()
     if (!VITAL_TYPES.includes(key)) {
       setFormError(`Unsupported vital type. Choose one of: ${VITAL_TYPES.join(', ')}.`)
       return
     }

     const valueInput = prompt(`Numeric value for ${key}:`)
     if (valueInput === null) return
     const value = valueInput.trim()
     if (!value || !Number.isFinite(Number(value))) {
       setFormError('Enter a valid numeric value for the vital.')
       return
     }
     setForm(prev => ({ ...prev, vitals: { ...prev.vitals, [key]: value } }))
   }

   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault()
     setSaved(false)
     setFormError(null)

     if (!personId || !caregiverId) {
       setFormError('Sign in and select an authorized caregiver and care record before saving.')
       return
     }

     const vitalEntries = Object.entries(form.vitals)
     const hasInvalidVital = vitalEntries.some(([key, value]) =>
       !VITAL_TYPES.includes(key) || !value.trim() || !Number.isFinite(Number(value))
     )
     if (hasInvalidVital) {
       setFormError('Every vital must have a supported type and a valid numeric value.')
       return
     }

     setSubmitting(true)
     const recordedAt = new Date().toISOString()
     const scales: Array<{ axis: string; score: number; observed_at: string; note: string | null }> = [
       ...(form.mood ? [{ axis: 'mood', score: form.mood_scale, observed_at: recordedAt, note: null }] : []),
       { axis: 'agitation', score: form.agitation_scale, observed_at: recordedAt, note: form.agitation_level || null },
       { axis: 'wellbeing_stress', score: form.wellbeing_stress, observed_at: recordedAt, note: form.wellbeing_notes.trim() || null },
     ]
     const noteSections = [
       { label: 'Behavior', value: form.behavior_notes },
       { label: 'Sleep', value: form.sleep_notes },
       { label: 'Eating/appetite', value: form.eating_notes },
       { label: 'Wellbeing', value: form.wellbeing_notes },
       { label: 'General', value: form.general_notes },
     ]
     const notes = noteSections
       .filter(section => section.value.trim())
       .map(section => `${section.label}: ${section.value.trim()}`)
       .join('\n')

     try {
       await postJSON('/daily/log', {
         person_id: personId,
         caregiver_id: caregiverId,
         medications: [],
         vitals: vitalEntries.map(([vital_type, value]) => ({
           vital_type,
           value: Number(value),
           measured_at: recordedAt,
           unit: null,
           note: null,
         })),
         scales,
         notes,
         location: form.location ? {
           latitude: form.location.latitude,
           longitude: form.location.longitude,
           accuracy: form.location.accuracy,
           timestamp: form.location.timestamp,
         } : undefined,
         location_provenance: form.location ? 'user_provided' : undefined,
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
         location: null,
       })
     } catch (error) {
       setSaved(false)
       setFormError(error instanceof Error ? error.message : 'Failed to save daily care entry.')
     } finally {
       setSubmitting(false)
     }
   }

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '4px' }}>What matters today</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
        Record changes, symptoms, behaviors, or observations from today. These build the Living Care Record over time.
      </p>

      <div style={{
        background: 'var(--trust-soft)', border: '1px solid var(--trust)',
        borderRadius: '8px', padding: '8px 14px', marginBottom: '16px'
      }}>
        <p style={{ fontSize: '12px', color: 'var(--trust)', marginBottom: '2px' }}>
          These entries automatically become part of your Living Care Record.
        </p>
        <p style={{ fontSize: '11px', color: 'var(--trust)', opacity: 0.8 }}>
          Examples: refused medication · wandering · sleep changes · appetite · new confusion
        </p>
      </div>

      <CareCapture personId={personId} />

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
              <option value="">Select caregiver</option>
              {caregivers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {caregiverError && <p style={{ fontSize: '11px', color: 'var(--unknown)', marginTop: '4px' }}>{caregiverError}</p>}
        </section>

        {/* Mood */}
        <section>
          <label htmlFor="daily-care-mood" style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block' }}>
            Mood
          </label>
          <select
            id="daily-care-mood"
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
          <label htmlFor="daily-care-agitation" style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block' }}>
            Agitation level
          </label>
          <select
            id="daily-care-agitation"
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
                    type="number" step="any" value={v}
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
         {/* Location */}
         <section>
           <h2 style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
             Location
           </h2>
           {locationState.status === 'granted' ? (
             <div>
               <p style={{ fontSize: '14px', marginBottom: '4px' }}>
                 Latitude: {form.location?.latitude.toFixed(6)}°, Longitude: {form.location?.longitude.toFixed(6)}°
               </p>
               <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                 Accuracy: {form.location?.accuracy} meters • Timestamp: {(form.location ? new Date(form.location.timestamp).toLocaleString() : '—')}
               </p>
               <button
                 type="button"
                 onClick={() => {
                   setForm(prev => ({ ...prev, location: null }));
                   setSaved(false);
                 }}
                 style={{
                   fontSize: '12px',
                   color: '#dc2626',
                   background: 'none',
                   border: 'none',
                   cursor: 'pointer',
                   marginTop: '8px',
                 }}
               >
                 Remove location
               </button>
             </div>
           ) : locationState.status === 'denied' || locationState.status === 'unsupported' ? (
             <div>
               <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                 Location access is unavailable or denied. You can still enter a location manually.
               </p>
               <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                 <input
                   type="number"
                   placeholder="Latitude"
                   value={form.location ? form.location.latitude : ''}
                   onChange={e => {
                     const val = parseFloat(e.target.value);
                     if (!isNaN(val)) {
                       setForm(prev => ({
                         ...prev,
                         location: {
                           ...(prev.location || { latitude: 0, longitude: 0, accuracy: 0, timestamp: Date.now() }),
                           latitude: val,
                         }
                       }));
                     }
                   }}
                   style={{
                     width: '120px',
                     padding: '8px 12px',
                     borderRadius: '6px',
                     border: '1px solid var(--border)',
                     background: 'var(--bg)',
                     fontSize: '13px',
                   }}
                 />
                 <input
                   type="number"
                   placeholder="Longitude"
                   value={form.location ? form.location.longitude : ''}
                   onChange={e => {
                     const val = parseFloat(e.target.value);
                     if (!isNaN(val)) {
                       setForm(prev => ({
                         ...prev,
                         location: {
                           ...(prev.location || { latitude: 0, longitude: 0, accuracy: 0, timestamp: Date.now() }),
                           longitude: val,
                         }
                       }));
                     }
                   }}
                   style={{
                     width: '120px',
                     padding: '8px 12px',
                     borderRadius: '6px',
                     border: '1px solid var(--border)',
                     background: 'var(--bg)',
                     fontSize: '13px',
                   }}
                 />
               </div>
             </div>
           ) : (
             <div>
               <button
                 type="button"
                 onClick={handleLocationRequest}
                 disabled={submitting}
                 style={{
                   padding: '10px 20px',
                   borderRadius: '6px',
                   border: '1px solid var(--border)',
                   background: locationState.status === 'unknown' ? 'var(--accent)' : 'var(--text-secondary)',
                   color: 'white',
                   fontSize: '13px',
                   fontWeight: 500,
                   cursor: locationState.status === 'unknown' ? 'pointer' : 'default',
                 }}
               >
                 {locationState.status === 'unknown' ? 'Use my current location' : 'Location unavailable'}
               </button>
               {locationState.status === 'error' && (
                 <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                   {locationState.message}
                 </p>
               )}
             </div>
           )}
         </section>
         {formError && (
           <p role="alert" style={{ color: 'var(--error)', fontSize: '13px' }}>
             {formError}
           </p>
         )}
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
