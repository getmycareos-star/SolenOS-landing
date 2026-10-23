import { useMemo } from "react";
import {
  buildAppointmentBriefings,
  type AppointmentSourceEvidence,
} from "../lib/document-intelligence/appointment-briefings";

type Props = {
  evidence: readonly AppointmentSourceEvidence[];
};

export default function AppointmentBriefings({ evidence }: Props) {
  const briefings = useMemo(() => buildAppointmentBriefings(evidence), [evidence]);
  if (briefings.length === 0) return null;

  return (
    <section
      aria-labelledby="appointment-briefings-heading"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "14px 16px",
        marginBottom: "16px",
      }}
    >
      <h2 id="appointment-briefings-heading" style={{ fontSize: "15px", margin: "0 0 4px" }}>
        Appointment briefings
      </h2>
      <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 12px", lineHeight: 1.5 }}>
        These are source-linked preparation notes, not confirmed bookings or medical instructions.
        Check the original document before acting.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {briefings.map((briefing) => (
          <article key={briefing.id} style={{ borderTop: "1px solid var(--border)", paddingTop: "10px" }}>
            <p style={{ fontSize: "13px", lineHeight: 1.5, margin: "0 0 8px" }}>
              <strong>Source statement:</strong> {briefing.sourceSentence}
            </p>
            <dl style={{ display: "grid", gridTemplateColumns: "minmax(90px, 120px) 1fr", gap: "5px 10px", margin: 0, fontSize: "12px" }}>
              <dt style={{ color: "var(--text-secondary)" }}>Date / time</dt>
              <dd style={{ margin: 0 }}>{briefing.when ?? "Not stated — confirm"}</dd>
              <dt style={{ color: "var(--text-secondary)" }}>Clinician / service</dt>
              <dd style={{ margin: 0 }}>{briefing.who ?? "Not stated — confirm"}</dd>
              <dt style={{ color: "var(--text-secondary)" }}>Preparation</dt>
              <dd style={{ margin: 0 }}>
                {briefing.preparation.length
                  ? briefing.preparation.join(" ")
                  : "No preparation details found in this source."}
              </dd>
              <dt style={{ color: "var(--text-secondary)" }}>Evidence reference</dt>
              <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{briefing.sourceType} · {briefing.sourceEvidenceId}</dd>
            </dl>
            <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: "8px 0 0" }}>
              Confirm: {briefing.detailsToConfirm.join(" ")}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
