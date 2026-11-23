"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ensureAnonymousSession, getJSON } from "@/api/client";
import { caregiverStatusLabel, caregiverSourceText } from "@/lib/caregiver-language";
import { RecordState } from "@/components/ui/RecordState";

type AppointmentBrief = {
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      await ensureAnonymousSession();
      const result = await getJSON("/appointment-workspaces/preparation-brief?window_days=90") as AppointmentBrief;
      if (!result || !Array.isArray(result.appointments)) {
        throw new Error("Appointment information could not be verified.");
      }
      setBrief(result);
    } catch {
      setBrief(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const appointment = brief?.next_appointment ?? null;

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
      ) : appointment ? (
        <div className="solenos-upcoming-appointment__item">
          <strong>{caregiverSourceText(appointment.title) || "Recorded appointment"}</strong>
          <p>{displayDate(appointment.scheduled_at)} · {caregiverStatusLabel(appointment.status) || "Status not recorded"}</p>
          {appointment.provider && <p>{caregiverSourceText(appointment.provider)}</p>}
          {appointment.location && <p>{caregiverSourceText(appointment.location)}</p>}
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
      ) : brief?.appointment_context_status?.code === "no_appointment_information" ? (
        <p role="status">No appointment information was returned from the available sources. This does not prove that no appointment exists.</p>
      ) : (
        <p role="status">Appointment information could not be confirmed in this summary.</p>
      )}
    </section>
  );
}
