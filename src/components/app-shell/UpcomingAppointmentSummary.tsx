"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ensureAnonymousSession, getJSON } from "@/api/client";
import { caregiverStatusLabel, caregiverSourceText } from "@/lib/caregiver-language";
import { RecordState } from "@/components/ui/RecordState";

type AppointmentBrief = {
  person_scope_verified?: boolean;
  person_id?: string;
  read_only?: boolean;
  next_appointment?: {
    source_id: string;
    title: string;
    scheduled_at?: string | null;
    provider?: string | null;
    location?: string | null;
    status: string;
  } | null;
  appointments?: Array<{
    source_id: string;
    title: string;
    scheduled_at?: string | null;
    status: string;
  }>;
  appointment_context_status?: {
    code?: string;
    has_appointment_information?: boolean;
  };
  appointment_related_open_loops?: Array<{
    source_id: string;
    title: string;
    description?: string | null;
    status: string;
    priority?: string | null;
    deadline_at?: string | null;
    appointment_id?: string | null;
  }>;
  appointment_needs?: Array<{
    source_id: string;
    question: string;
    priority?: string | null;
    status: string;
  }>;
  lcr_retrieval_status?: {
    status?: "complete" | "partial" | "failed" | string;
    failed_sources?: string[];
  };
};

function displayDate(value?: string | null) {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date not recorded" : date.toLocaleString();
}

/**
 * A compact view of appointment information already returned by the
 * appointment workflow. It never creates, books, or infers an appointment.
 */
export function UpcomingAppointmentSummary() {
  const [brief, setBrief] = useState<AppointmentBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestVersion.current;
    setLoading(true);
    setError(false);
    try {
      const session = await ensureAnonymousSession();
      const activePersonId = session.person?.id;
      const result = await getJSON("/appointment-workspaces/preparation-brief?window_days=90") as AppointmentBrief;
      if (
        !result ||
        !activePersonId ||
        result.person_scope_verified !== true ||
        result.person_id !== activePersonId ||
        result.read_only !== true ||
        !Array.isArray(result.appointments)
      ) {
        throw new Error("Appointment information could not be verified for the active care record.");
      }
      if (requestId !== requestVersion.current) return;
      setBrief(result);
    } catch {
      if (requestId !== requestVersion.current) return;
      setBrief(null);
      setError(true);
    } finally {
      if (requestId === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refreshAfterPersonChange = () => {
      setBrief(null);
      void load();
    };
    const refreshAfterRecordWrite = () => { void load(); };
    window.addEventListener("personIdChanged", refreshAfterPersonChange);
    window.addEventListener("careRecordUpdated", refreshAfterRecordWrite);
    return () => {
      requestVersion.current += 1;
      window.removeEventListener("personIdChanged", refreshAfterPersonChange);
      window.removeEventListener("careRecordUpdated", refreshAfterRecordWrite);
    };
  }, [load]);

  const appointment = brief?.next_appointment ?? null;
  const appointmentStatus = String(appointment?.status ?? "").trim().toLowerCase();
  const appointmentFollowUps = brief?.appointment_related_open_loops ?? [];
  const appointmentQuestions = brief?.appointment_needs ?? [];
  const retrievalStatus = brief?.lcr_retrieval_status?.status;
  const appointmentContextCode = brief?.appointment_context_status?.code;
  const appointmentContextIncomplete = retrievalStatus === "partial" || retrievalStatus === "failed" || appointmentContextCode === "retrieval_failed";
  const appointmentHasTime = Boolean(appointment?.scheduled_at && /T\d{2}:\d{2}/.test(appointment.scheduled_at));
  const appointmentTime = appointmentHasTime ? Date.parse(appointment?.scheduled_at ?? "") : Number.NaN;
  const appointmentIsPast = Boolean(
    appointment &&
    appointmentHasTime &&
    Number.isFinite(appointmentTime) &&
    appointmentTime <= Date.now() &&
    !["cancelled", "canceled", "completed", "no_show", "no-show"].includes(appointmentStatus)
  );
  const appointmentIsTimeSensitive = Boolean(
    appointment &&
    appointmentHasTime &&
    Number.isFinite(appointmentTime) &&
    appointmentTime > Date.now() &&
    appointmentTime - Date.now() <= 24 * 60 * 60 * 1000 &&
    !["cancelled", "canceled", "completed", "no_show", "no-show"].includes(appointmentStatus)
  );
  const appointmentCanBePrepared = Boolean(
    appointment &&
    !["cancelled", "canceled", "completed", "no_show", "no-show"].includes(appointmentStatus)
  );
  const appointmentActionLabel = appointmentIsPast || ["overdue", "date_unknown"].includes(appointmentStatus)
    ? "Review appointment details"
    : "Prepare for this visit";

  return (
    <section className="solenos-upcoming-appointment" aria-labelledby="solenos-upcoming-appointment-title">
      <div className="solenos-upcoming-appointment__heading">
        <div>
          <h2 id="solenos-upcoming-appointment-title">Appointments</h2>
          <p>Visits already recorded in your Care Record.</p>
        </div>
        <Link href="/workspace/appointments">View appointments</Link>
      </div>
      {loading ? <RecordState kind="loading" title="Checking recorded appointments" /> : error ? (
        <RecordState kind="error" title="Appointment information is unavailable" description="Your saved care information has not been changed." onAction={() => void load()} />
      ) : (
        <>
          {appointmentContextIncomplete && (
            <p className="solenos-upcoming-appointment__notice" role="status">
              Some care-record sources could not be checked. The appointment information below may be incomplete.
            </p>
          )}
          {appointment ? (
            <div className={`solenos-upcoming-appointment__item${appointmentIsTimeSensitive ? " is-time-sensitive" : ""}`}>
              {appointmentIsTimeSensitive && <p className="solenos-upcoming-appointment__timing">Coming up within 24 hours</p>}
              <strong>{caregiverSourceText(appointment.title) || "Recorded appointment"}</strong>
              <p>{displayDate(appointment.scheduled_at)} · {caregiverStatusLabel(appointment.status) || "Status not recorded"}</p>
              {appointment.provider && <p>{caregiverSourceText(appointment.provider)}</p>}
              {appointment.location && <p>{caregiverSourceText(appointment.location)}</p>}
              {appointmentCanBePrepared && <p><Link className="solenos-upcoming-appointment__prepare" href="/workspace/appointments">{appointmentActionLabel}</Link></p>}
              <small>This is a Care Record entry. SolenOS has not booked or confirmed it with a provider.</small>
            </div>
          ) : (brief?.appointments?.length ?? 0) > 0 ? (
            <ul className="solenos-upcoming-appointment__list">
              {(brief?.appointments ?? []).slice(0, 2).map(item => (
                <li key={item.source_id}>
                  <strong>{caregiverSourceText(item.title) || "Recorded appointment"}</strong>
                  <span>{displayDate(item.scheduled_at)} · {caregiverStatusLabel(item.status) || "Status not recorded"}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {(appointmentFollowUps.length > 0 || appointmentQuestions.length > 0) && (
            <div className="solenos-upcoming-appointment__follow-ups">
              <h3>Appointment follow-ups</h3>
              {appointmentFollowUps.slice(0, 2).map(item => (
                <div key={`follow-up:${item.source_id}`}>
                  <strong>{caregiverSourceText(item.title) || "Recorded follow-up"}</strong>
                  {item.description && <p>{caregiverSourceText(item.description)}</p>}
                  <small>
                    {caregiverStatusLabel(item.status) || "Open"}
                    {item.deadline_at ? ` · Due ${displayDate(item.deadline_at)}` : ""}
                  </small>
                </div>
              ))}
              {appointmentQuestions.slice(0, 2).map(item => (
                <div key={`question:${item.source_id}`}>
                  <strong>{caregiverSourceText(item.question) || "Appointment question to resolve"}</strong>
                  <small>{caregiverStatusLabel(item.status) || "Open question"}</small>
                </div>
              ))}
              {appointmentFollowUps.length > 0 && <p><Link href="/workspace/open-loops">Review care follow-ups</Link></p>}
              {appointmentQuestions.length > 0 && <p><Link href="/workspace/care-continuity#lcr-clarification-workflow">Review appointment questions</Link></p>}
            </div>
          )}
          {!appointment && (brief?.appointments?.length ?? 0) === 0 && appointmentFollowUps.length === 0 && appointmentQuestions.length === 0 && (
            appointmentContextCode === "no_appointment_information" ? (
              <p role="status">No appointment information was returned from the available sources. This does not prove that no appointment exists.</p>
            ) : appointmentContextCode === "follow_up_needed" ? (
              <p role="status">A follow-up is recorded, but no appointment date or booking is confirmed.</p>
            ) : (
              <p role="status">Appointment information could not be confirmed in this summary.</p>
            )
          )}
        </>
      )}
    </section>
  );
}
