"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ensureAnonymousSession, getJSON } from "@/api/client";

type SavedAppointmentWorkspace = {
  id: string;
  appointment_id?: string | null;
  updated_at?: string | null;
  payload?: Record<string, unknown> | null;
};

type AppointmentAssertion = {
  subject_type: string;
  subject_id: string;
  assertion_status: string;
};

const readText = (value: unknown) => typeof value === "string" ? value.trim() : "";
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
};

function attendanceLabel(value: string, payload: Record<string, unknown>) {
  if (value === "attended") return "Attended";
  if (value === "cancelled") return "Cancelled";
  if (value === "rescheduled") return "Rescheduled";
  if (value === "missed") return "Missed";
  return "Outcome not yet recorded";
}

export default function AppointmentContinuitySummary() {
  const [records, setRecords] = useState<SavedAppointmentWorkspace[]>([]);
  const [assertions, setAssertions] = useState<AppointmentAssertion[]>([]);
  const [assertionsAvailable, setAssertionsAvailable] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await ensureAnonymousSession();
      const result = await getJSON("/appointment-workspaces") as { items?: SavedAppointmentWorkspace[] };
      if (cancelled) return;
      setRecords(Array.isArray(result.items) ? result.items : []);
      setLoadState("ready");
      try {
        const rows = await getJSON("/care-continuity/assertions/" + encodeURIComponent(session.person.id) + "?limit=200") as AppointmentAssertion[];
        if (!cancelled) {
          setAssertions(Array.isArray(rows) ? rows : []);
          setAssertionsAvailable(true);
        }
      } catch {
        if (!cancelled) setAssertionsAvailable(false);
      }
    })().catch(() => {
      if (!cancelled) setLoadState("unavailable");
    });
    return () => { cancelled = true; };
  }, []);

  const summary = useMemo(() => {
    const ordered = [...records].sort((a, b) => {
      const ap = a.payload || {};
      const bp = b.payload || {};
      const at = new Date(readText(ap.actualVisitAt) || readText(ap.visitDate) || a.updated_at || 0).getTime();
      const bt = new Date(readText(bp.actualVisitAt) || readText(bp.visitDate) || b.updated_at || 0).getTime();
      return bt - at;
    });
    const latest = ordered[0];
    if (!latest) return null;
    const payload = latest.payload || {};
    const followUps = (Array.isArray(payload.followUps) ? payload.followUps : [])
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map(item => ({
        action: readText(item.action),
        owner: readText(item.owner),
        due: readText(item.due),
        status: readText(item.status) || "Not started",
        resultStatus: readText(item.resultStatus) || "Not expected",
        register: item.register === true,
      }))
      .filter(item => item.register && item.action);
    const outstanding = followUps.filter(item => !["Completed", "Cancelled"].includes(item.status));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = outstanding.filter(item => {
      if (!item.due) return false;
      const due = new Date(item.due + "T00:00:00");
      return !Number.isNaN(due.getTime()) && due < today;
    });
    const resultsToReview = followUps.filter(item => item.resultStatus === "Received");
    const resultsExpected = followUps.filter(item => item.resultStatus === "Waiting" || item.status === "Waiting for result");
    const questions = readText(payload.unanswered).split(/\n+/).map(item => item.trim()).filter(Boolean);
    const acceptedEntries = assertions.filter(item => item.subject_type === "appointment" && item.subject_id === latest.id && item.assertion_status === "accepted").length;
    const outcomeNotes = [
      { label: "Caregiver report", text: readText(payload.caregiverReport) },
      { label: "Professional statement reported by caregiver", text: readText(payload.clinicianFindings) },
      { label: "Decision recorded by caregiver", text: readText(payload.decisions) },
      { label: "Instruction reported by caregiver", text: readText(payload.instructions) },
      { label: "Tests and referrals reported by caregiver", text: readText(payload.testsReferrals) },
    ].filter(item => item.text).slice(0, 3);
    const title = readText(payload.visitPurpose) || readText(payload.specialty) || readText(payload.clinician) || "Healthcare visit";
    const attendanceStatus = readText(payload.attendanceStatus);
    const visitDate = attendanceStatus === "attended"
      ? readText(payload.actualVisitAt)
      : attendanceStatus === "rescheduled"
        ? readText(payload.rescheduledAt) || readText(payload.visitDate)
        : readText(payload.visitDate) || readText(latest.updated_at);
    return {
      latest,
      payload,
      title,
      visitDate,
      attendance: attendanceLabel(readText(payload.attendanceStatus), payload),
      outstanding,
      overdue,
      resultsToReview,
      resultsExpected,
      questions,
      acceptedEntries,
      outcomeNotes,
    };
  }, [records, assertions]);

  if (loadState === "loading" || (loadState === "ready" && !summary)) return null;

  return (
    <section className="appointment-continuity-summary" aria-labelledby="appointment-continuity-summary-title">
      <div className="appointment-continuity-summary__heading">
        <div>
          <p className="appointment-continuity-summary__eyebrow">APPOINTMENT CONTINUITY</p>
          <h2 id="appointment-continuity-summary-title">What happened and what comes next</h2>
        </div>
        <Link href="/workspace/appointments">Open appointments</Link>
      </div>
      {loadState === "unavailable" ? (
        <p role="status" className="appointment-continuity-summary__notice">Appointment details could not be loaded. Your saved notes have not been changed.</p>
      ) : summary ? (
        <>
          <div className="appointment-continuity-summary__visit">
            <div>
              <strong>{summary.title}</strong>
              <span>{summary.visitDate ? dateLabel(summary.visitDate) : "Date not recorded"} · {summary.attendance}</span>
            </div>
            <span>{assertionsAvailable ? summary.acceptedEntries ? summary.acceptedEntries + (summary.acceptedEntries === 1 ? " care-history entry added from this visit" : " care-history entries added from this visit") : "No care-history entries added from this visit" : "Care-history updates could not be checked"}</span>
          </div>
          {summary.outcomeNotes.length > 0 && <section className="appointment-continuity-summary__notes">
            <h3>What was recorded about the visit</h3>
            {summary.outcomeNotes.map((item, index) => <p key={summary.latest.id + "-outcome-" + index}><strong>{item.label}</strong><span>{item.text}</span></p>)}
            <small>These are the caregiver’s saved notes. A reported professional statement is not presented as an original professional document.</small>
          </section>}
          <div className="appointment-continuity-summary__grid">
            <section>
              <h3>Follow-ups still open</h3>
              {summary.outstanding.length ? <ul>{summary.outstanding.slice(0, 4).map((item, index) => <li key={summary.latest.id + "-followup-" + index}>
                <strong>{item.action}</strong>
                <span>{item.owner ? "Responsible: " + item.owner : "No responsible person recorded"}{item.due ? " · Due " + dateLabel(item.due) : " · No due date"}</span>
                <small>{item.status}{item.due && summary.overdue.includes(item) ? " · Overdue" : ""}</small>
              </li>)}</ul> : <p>No follow-up responsibilities have been added to these notes.</p>}
            </section>
            <section>
              <h3>Results and questions</h3>
              {summary.resultsToReview.length ? <p><strong>{summary.resultsToReview.length}</strong> result{summary.resultsToReview.length === 1 ? "" : "s"} received and waiting for review.</p> : null}
              {summary.resultsExpected.length ? <p><strong>{summary.resultsExpected.length}</strong> result{summary.resultsExpected.length === 1 ? "" : "s"} still expected.</p> : null}
              {summary.questions.length ? <ul>{summary.questions.slice(0, 3).map((question, index) => <li key={summary.latest.id + "-question-" + index}>{question}</li>)}</ul> : null}
              {!summary.resultsToReview.length && !summary.resultsExpected.length && !summary.questions.length ? <p>No outstanding result or question is recorded in these notes.</p> : null}
            </section>
          </div>
        </>
      ) : null}
      <style jsx>{`
        .appointment-continuity-summary { margin: 0 0 22px; padding: 18px; border: 1px solid #dce6da; border-radius: 14px; background: #fbfdfb; color: #26392c; }
        .appointment-continuity-summary__heading { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:14px; }
        .appointment-continuity-summary__eyebrow { margin:0 0 5px; color:#64736b; font-size:10px; font-weight:800; letter-spacing:.08em; }
        .appointment-continuity-summary h2 { margin:0; color:#172b35; font-size:clamp(17px,2.2vw,21px); line-height:1.25; }
        .appointment-continuity-summary__heading a { color:#315a43; font-size:12px; font-weight:750; text-decoration:underline; text-underline-offset:3px; white-space:nowrap; }
        .appointment-continuity-summary__visit { display:flex; justify-content:space-between; gap:12px; padding:12px; border-radius:10px; background:#f0f5ef; }
        .appointment-continuity-summary__visit div { display:flex; flex-direction:column; gap:4px; }
        .appointment-continuity-summary__visit strong { font-size:13px; }
        .appointment-continuity-summary__visit span { color:#58685e; font-size:11px; }
        .appointment-continuity-summary__notes { margin-top:12px; padding:12px; border:1px solid #e3ebe1; border-radius:10px; background:#fff; }
        .appointment-continuity-summary__notes h3 { margin:0 0 9px; color:#344b3b; font-size:12px; }
        .appointment-continuity-summary__notes p { margin:0 0 8px; color:#26392c; font-size:12px; line-height:1.45; }
        .appointment-continuity-summary__notes p strong,.appointment-continuity-summary__notes p span { display:block; }
        .appointment-continuity-summary__notes p strong { margin-bottom:2px; }
        .appointment-continuity-summary__notes small { color:#5c6b61; font-size:10px; line-height:1.4; }
        .appointment-continuity-summary__grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:12px; }
        .appointment-continuity-summary__grid section { min-width:0; padding:12px; border:1px solid #e3ebe1; border-radius:10px; background:#fff; }
        .appointment-continuity-summary h3 { margin:0 0 9px; color:#344b3b; font-size:12px; }
        .appointment-continuity-summary ul { margin:0; padding-left:17px; }
        .appointment-continuity-summary li { margin:0 0 8px; font-size:12px; line-height:1.45; }
        .appointment-continuity-summary li strong,.appointment-continuity-summary li span,.appointment-continuity-summary li small { display:block; }
        .appointment-continuity-summary li span,.appointment-continuity-summary li small,.appointment-continuity-summary p { color:#5c6b61; font-size:11px; line-height:1.45; }
        .appointment-continuity-summary li small { margin-top:2px; }
        .appointment-continuity-summary__notice { margin:0; }
        @media(max-width:640px) { .appointment-continuity-summary { padding:14px; } .appointment-continuity-summary__heading { flex-direction:column; } .appointment-continuity-summary__grid { grid-template-columns:1fr; } .appointment-continuity-summary__visit { flex-direction:column; } }
      `}</style>
    </section>
  );
}
