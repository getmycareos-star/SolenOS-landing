'use client'

import { useEffect, useRef, useState } from 'react'
import { ensureAnonymousSession, getJSON, postJSON, patchJSON } from '@/api/client'
import { CalendarDays, ShieldCheck } from 'lucide-react'

type Stage = 'prepare' | 'during' | 'after'
type PreparationBrief = {
  snapshot_at: string
  facts: Array<{ source_id: string; fact_type: string; value: string | null; epistemic_status: string; effective_at?: string | null }>
  events: Array<{ source_id: string; title: string; description?: string | null; occurred_at?: string | null; status: string }>
  appointments: Array<{ source_id: string; title: string; scheduled_at?: string | null; provider?: string | null; location?: string | null; status: string }>
  limitations: string[]
  source_coverage: Record<string, string>
}
type WorkspaceRecord = {
  id: string
  appointment_id?: string | null
  status: string
  version_number: number
  payload: Record<string, unknown>
}
type OutcomeDraft = {
  status: string
  read_only: boolean
  updates_lcr: boolean
  sections: Record<string, Array<{ label?: string; text: string; epistemic_status?: string; source_type?: string }>>
  missing_information: string[]
  limitations: string[]
}

const stageStatus: Record<Stage, string> = {
  prepare: 'preparation',
  during: 'during_visit',
  after: 'outcome_pending',
}

export default function AppointmentWorkspace() {
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<Stage>('prepare')
  const [brief, setBrief] = useState<PreparationBrief | null>(null)
  const [record, setRecord] = useState<WorkspaceRecord | null>(null)
  const [appointmentId, setAppointmentId] = useState('')
  const [outcome, setOutcome] = useState<OutcomeDraft | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const pendingSaveRef = useRef<{ fingerprint: string; key: string; recordedAt: string } | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError('')
    void (async () => {
      try {
        await ensureAnonymousSession()
        const [briefResult, workspaceResult] = await Promise.allSettled([
          getJSON('/appointment-workspaces/preparation-brief?window_days=90') as Promise<PreparationBrief>,
          getJSON('/appointment-workspaces') as Promise<{ items?: WorkspaceRecord[] }>,
        ])
        if (cancelled) return
        if (briefResult.status === 'fulfilled') {
          setBrief(briefResult.value)
          const nextAppointment = briefResult.value.appointments.find(item => item.status.toLowerCase() === 'scheduled')
          if (nextAppointment) setAppointmentId(nextAppointment.source_id)
        } else {
          setError('Your appointment brief could not be loaded. Your care record has not been changed.')
        }
        if (workspaceResult.status === 'fulfilled') {
          const latest = workspaceResult.value.items?.[0] || null
          if (latest) {
            setRecord(latest)
            if (latest.appointment_id) setAppointmentId(latest.appointment_id)
            setNote(typeof latest.payload?.caregiverReport === 'string' ? latest.payload.caregiverReport : '')
            try {
              const draft = await getJSON('/appointment-workspaces/' + encodeURIComponent(latest.id) + '/outcome-draft') as OutcomeDraft
              if (!cancelled) setOutcome(draft)
            } catch {
              if (!cancelled) setOutcome(null)
            }
          }
        } else {
          setError('Saved appointment information could not be loaded. Your care record has not been changed.')
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Appointment support could not be opened.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open])

  const refreshOutcome = async (recordId: string) => {
    const draft = await getJSON('/appointment-workspaces/' + encodeURIComponent(recordId) + '/outcome-draft') as OutcomeDraft
    setOutcome(draft)
  }

  const saveNote = async () => {
    if (!note.trim()) {
      setMessage('Nothing to save. You can continue without adding a note.')
      if (stage === 'after' && record) {
        try { await refreshOutcome(record.id) } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'The outcome could not be refreshed.')
        }
      }
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await ensureAnonymousSession()
      const nextStatus = record
        ? record.status === 'preparation' && stage !== 'prepare'
          ? stage === 'during' ? 'during_visit' : 'outcome_pending'
          : record.status === 'during_visit' && stage === 'after' ? 'outcome_pending' : record.status
        : stageStatus[stage]
      const fingerprint = JSON.stringify({
        recordId: record?.id ?? null,
        appointmentId: appointmentId || null,
        expectedVersion: record?.version_number ?? null,
        stage,
        nextStatus,
        note: note.trim(),
      })
      if (!pendingSaveRef.current || pendingSaveRef.current.fingerprint !== fingerprint) {
        pendingSaveRef.current = {
          fingerprint,
          key: `appointment-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2)}`,
          recordedAt: new Date().toISOString(),
        }
      }
      const pendingSave = pendingSaveRef.current
      const payload = {
        ...(record?.payload || {}),
        caregiverReport: note.trim(),
        captureStage: stage,
        caregiverReportAt: pendingSave.recordedAt,
        lcr_reconciliation: 'not_performed',
      }
      const recordVersion = record?.version_number ?? 0
      let saved: WorkspaceRecord
      if (record) {
        saved = await patchJSON('/appointment-workspaces/' + encodeURIComponent(record.id), {
          expected_version: recordVersion,
          status: nextStatus,
          payload,
          change_reason: 'Caregiver saved an optional appointment note',
          idempotency_key: pendingSave.key,
        }) as WorkspaceRecord
      } else {
        saved = await postJSON('/appointment-workspaces', {
          appointment_id: appointmentId || undefined,
          status: nextStatus,
          payload,
          change_reason: 'Caregiver saved an optional appointment note',
          idempotency_key: pendingSave.key,
        }) as WorkspaceRecord
      }
      pendingSaveRef.current = null
      setRecord(saved)
      setMessage('Your note is saved as a caregiver report.')
      if (stage === 'after') {
        try {
          await refreshOutcome(saved.id)
        } catch {
          setError('Your note was saved. The outcome view could not refresh; reopen appointment support to retry.')
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your note could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="appointment-workspace guided-appointment" aria-labelledby="appointment-workspace-title">
      <div className="appointment-heading">
        <div className="appointment-heading-icon" aria-hidden="true"><CalendarDays size={21} /></div>
        <div className="appointment-heading-copy">
          <span className="appointment-kicker">APPOINTMENTS</span>
          <h3 id="appointment-workspace-title">Your appointment, supported by SolenOS</h3>
          <p>SolenOS prepares and organises the information. You only add what it cannot know.</p>
        </div>
        <button type="button" className="appointment-primary" onClick={() => setOpen(value => !value)} aria-expanded={open}>
          {open ? 'Close' : 'Open appointment support'}
        </button>
      </div>

      {open && <>
        <div className="appointment-boundary"><ShieldCheck size={17} aria-hidden="true" /><span>You are not expected to complete forms before, during or after a visit. Notes are optional. Caregiver reports stay attributed to the caregiver, and nothing here silently changes the Living Care Record.</span></div>
        <nav className="guided-stages" aria-label="Appointment stages">
          {([['prepare', 'Before'], ['during', 'During'], ['after', 'After']] as const).map(([key, label]) => (
            <button key={key} type="button" className={stage === key ? 'is-active' : ''} aria-pressed={stage === key} onClick={() => setStage(key)}>{label}</button>
          ))}
        </nav>

        {loading && <p className="guided-muted" role="status">Preparing your appointment view…</p>}

        {stage === 'prepare' && <div className="guided-panel">
          <div className="guided-panel-heading"><div><h4>Your appointment brief</h4><p>Prepared from information already in the Living Care Record. Nothing to fill in.</p></div><span className="guided-state">Read-only</span></div>
          {!brief && <p className="guided-muted">Your care history could not be loaded. Missing information is not treated as proof that it does not exist.</p>}
          {brief && <>
            <div className="guided-columns">
              <section><h5>Recent care history</h5>{brief.events.length ? <ul>{brief.events.slice(0, 6).map(item => <li key={item.source_id}><strong>{item.title}</strong>{item.description && <p>{item.description}</p>}<small>{item.occurred_at ? new Date(item.occurred_at).toLocaleDateString() : 'Date not recorded'} · {item.status}</small><small>Source reference: {item.source_id}</small></li>)}</ul> : <p className="guided-muted">No recent care events were returned for this brief.</p>}</section>
              <section><h5>Recorded care information</h5>{brief.facts.length ? <ul>{brief.facts.slice(0, 6).map(item => <li key={item.source_id}><strong>{item.fact_type.replaceAll('_', ' ')}</strong><p>{item.value || 'No detail recorded'}</p><small>{item.epistemic_status.replaceAll('_', ' ')}</small><small>Source reference: {item.source_id}</small></li>)}</ul> : <p className="guided-muted">No care facts were returned for this brief.</p>}</section>
            </div>
            <section className="guided-appointments"><h5>Appointments in the care record</h5>{brief.appointments.length ? <ul>{brief.appointments.slice(0, 5).map(item => <li key={item.source_id}><strong>{item.title}</strong><span>{item.scheduled_at ? new Date(item.scheduled_at).toLocaleString() : 'Date not recorded'} · {item.status}</span></li>)}</ul> : <p className="guided-muted">No appointment was returned. This does not establish that no appointment exists.</p>}</section>
            <section className="guided-coverage" aria-label="Source availability">
              <h5>Source availability</h5>
              <p className="guided-muted">Unavailable or excluded sources are shown explicitly. Missing data is not evidence that a care event did not occur.</p>
              <ul>{Object.entries(brief.source_coverage).map(([source, status]) => <li key={source}><span>{source.replaceAll('_', ' ')}</span><strong>{status.replaceAll('_', ' ')}</strong></li>)}</ul>
            </section>
            <p className="guided-footnote">Prepared {new Date(brief.snapshot_at).toLocaleString()}. Reports, dates and unknowns remain separate.</p>
          </>}
        </div>}

        {stage === 'during' && <div className="guided-panel">
          <div className="guided-panel-heading"><div><h4>Stay with the appointment</h4><p>You do not need to document while speaking with the professional.</p></div><span className="guided-state">Optional</span></div>
          <p className="guided-muted">If it helps, leave yourself one short note. You can leave this empty and return later.</p>
          <label className="guided-capture-label">Anything you want to remember?
            <textarea value={note} onChange={event => setNote(event.target.value)} rows={4} placeholder="Optional note. Your own words are enough." />
          </label>
          <button className="guided-primary" type="button" onClick={() => void saveNote()} disabled={saving}>{saving ? 'Saving…' : 'Save note and continue'}</button>
          <p className="guided-footnote">A saved note is attributed to the caregiver. It is not a verified professional statement and does not change the Living Care Record.</p>
        </div>}

        {stage === 'after' && <div className="guided-panel">
          <div className="guided-panel-heading"><div><h4>Appointment information gathered</h4><p>SolenOS organises what has actually been recorded. You can return later if nothing is available yet.</p></div><span className="guided-state">Review first</span></div>
          <label className="guided-capture-label">Add anything you remember, if you want to
            <textarea value={note} onChange={event => setNote(event.target.value)} rows={4} placeholder="A short note is enough. You can also leave this empty." />
          </label>
          <div className="guided-actions">
            <button className="guided-primary" type="button" onClick={() => void saveNote()} disabled={saving}>{saving ? 'Saving…' : 'Save what I remember'}</button>
            <button className="guided-secondary" type="button" onClick={() => record && void refreshOutcome(record.id)} disabled={!record}>Refresh outcome</button>
          </div>
          {outcome?.status === 'ready_for_review' && <div className="guided-outcome" aria-live="polite">
            <h5>Information available for review</h5>
            {Object.entries(outcome.sections).filter(([, items]) => items.length).map(([key, items]) => <section key={key}><h6>{key.replaceAll('_', ' ')}</h6>{items.map((item, index) => <p key={key + index}>{item.text}<small>{item.epistemic_status?.replaceAll('_', ' ') || 'Recorded information'} · {item.source_type?.replaceAll('_', ' ') || 'Caregiver record'}</small></p>)}</section>)}
            {outcome.missing_information.length > 0 && <p className="guided-muted">Not recorded: {outcome.missing_information.join(', ')}.</p>}
            <p className="guided-footnote">This is a review draft, not a clinical conclusion. The Living Care Record has not been changed.</p>
          </div>}
          {(!outcome || outcome.status === 'no_outcome_information') && <p className="guided-muted">No appointment outcome has been recorded yet. You can return later; SolenOS will not invent what happened.</p>}
          {outcome?.limitations?.map((item, index) => <p className="guided-footnote" key={index}>{item}</p>)}
        </div>}

        <div className="guided-status" role="status" aria-live="polite">{message}{error && <span>{error}</span>}</div>
      </>}
      <style jsx>{`
        .guided-appointment { color:#26392c; }
        .guided-stages { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin:18px 0 0; }
        .guided-stages button { min-height:44px; border:1px solid #dfe8df; border-radius:11px; background:#fff; color:#536653; font:inherit; font-size:13px; font-weight:750; cursor:pointer; }
        .guided-stages button.is-active { border-color:#a7c3a4; background:#edf5eb; color:#294b31; }
        .guided-panel { margin-top:16px; padding:16px; border:1px solid #e2eae0; border-radius:14px; background:#fbfcfa; }
        .guided-panel-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
        .guided-panel h4 { margin:0; color:#26392c; font-size:17px; }
        .guided-panel-heading p,.guided-muted { margin:5px 0 0; color:#68776b; font-size:12px; line-height:1.6; }
        .guided-state { padding:5px 8px; border:1px solid #dce7d9; border-radius:99px; color:#526b54; font-size:10px; white-space:nowrap; }
        .guided-columns { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:15px; }
        .guided-columns section,.guided-appointments { min-width:0; padding:12px; border:1px solid #e5ebe2; border-radius:11px; background:#fff; }
        .guided-panel h5 { margin:0 0 9px; color:#3b5140; font-size:12px; }
        .guided-columns ul,.guided-appointments ul { margin:0; padding-left:17px; }
        .guided-columns li { margin:0 0 11px; color:#425447; font-size:12px; line-height:1.5; overflow-wrap:anywhere; }
        .guided-columns li p { margin:3px 0; }
        .guided-columns li small,.guided-appointments li span { display:block; color:#7a867c; font-size:10px; }
        .guided-appointments { margin-top:12px; }
        .guided-coverage { margin-top:12px; padding:12px; border:1px solid #e5ebe2; border-radius:11px; background:#fff; }
        .guided-coverage ul { display:grid; gap:7px; margin:0; padding:0; list-style:none; }
        .guided-coverage li { display:flex; justify-content:space-between; gap:10px; color:#536653; font-size:11px; }
        .guided-coverage strong { color:#334b38; font-weight:700; text-align:right; }
        .guided-appointments li { display:flex; justify-content:space-between; gap:10px; margin:7px 0; font-size:12px; }
        .guided-footnote { margin:12px 0 0; color:#7b877d; font-size:10px; line-height:1.55; }
        .guided-capture-label { display:flex; flex-direction:column; gap:7px; margin-top:14px; color:#405343; font-size:12px; font-weight:750; }
        .guided-capture-label textarea { width:100%; box-sizing:border-box; min-height:100px; padding:12px; border:1px solid #dce6da; border-radius:10px; background:#fff; color:#26392c; font:inherit; font-size:14px; line-height:1.55; resize:vertical; }
        .guided-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
        .guided-primary,.guided-secondary { min-height:42px; padding:10px 14px; border:1px solid #cbdcc9; border-radius:11px; background:#e7f0e5; color:#203b27; font:inherit; font-size:12px; font-weight:750; cursor:pointer; }
        .guided-secondary { background:#fff; }
        .guided-primary:disabled,.guided-secondary:disabled { opacity:.6; cursor:not-allowed; }
        .guided-outcome { margin-top:16px; padding:14px; border:1px solid #dfe8df; border-radius:12px; background:#fff; }
        .guided-outcome h5 { margin:0 0 12px; }
        .guided-outcome section { padding:10px 0; border-top:1px solid #edf1eb; }
        .guided-outcome h6 { margin:0 0 5px; color:#526653; font-size:11px; text-transform:capitalize; }
        .guided-outcome p { margin:0; color:#34493a; font-size:12px; line-height:1.55; white-space:pre-wrap; }
        .guided-outcome small { display:block; margin-top:4px; color:#7a867c; font-size:10px; }
        .guided-status { margin-top:10px; color:#59705c; font-size:11px; }
        .guided-status span { display:block; color:#9a5c43; margin-top:4px; }
        @media(max-width:640px) { .guided-columns { grid-template-columns:minmax(0,1fr); } .guided-appointments li { display:block; } .guided-actions button,.guided-primary { width:100%; } .guided-panel { padding:13px; } }
      `}</style>
    </section>
  )
}
