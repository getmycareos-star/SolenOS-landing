"use client";

import type { ContinuityHomeView } from "@/lib/mvp-surface-area";
import type { CanonicalCareEvent } from "@/lib/situation-entry";
import {
  dedupeCaregiverFacingLines,
  isCaregiverSafeDisplayText,
  sanitizeCaregiverDisplayText,
} from "@/lib/mvp-input-architecture";
import { isCaregiverFacingAsk } from "@/lib/progressive-understanding";
import { TrustEmptyStateNote } from "@/components/trust/TrustDiscoveryNote";

type Props = {
  home: ContinuityHomeView;
  events?: CanonicalCareEvent[];
  className?: string;
};

function resolveEventLabel(events: CanonicalCareEvent[], id: string): string {
  const event = events?.find((e) => e.id === id);
  if (!event) return "";
  return sanitizeCaregiverDisplayText(event.raw_input).slice(0, 120);
}

/**
 * Calm continuity surface — Response Contract (ADR-022): hold the record, never re-open a quiz.
 */
export function ContinuityHomePanel({ home, events = [], className }: Props) {
  const { since_last_visit, needs_attention } = home;

  const seenIds = new Set<string>();
  const changedLines: string[] = [];
  for (const id of [
    ...since_last_visit.new_events,
    ...since_last_visit.newly_emerged_risks,
  ]) {
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const label = resolveEventLabel(events, id);
    if (label && isCaregiverSafeDisplayText(label)) changedLines.push(label);
  }
  const changed = dedupeCaregiverFacingLines(changedLines, 5);

  const attention = dedupeCaregiverFacingLines(
    [
      ...needs_attention.unresolved_questions,
      ...needs_attention.pending_follow_ups,
      ...needs_attention.missing_information,
    ].filter((line) => isCaregiverSafeDisplayText(line) && isCaregiverFacingAsk(line)),
    1,
  );

  const recent = dedupeCaregiverFacingLines(
    home.recent_events
      .filter((e) => !seenIds.has(e.id))
      .map((e) => e.label)
      .filter((l) => l && isCaregiverSafeDisplayText(l)),
    5,
  );

  const isSparse =
    events.length === 0 &&
    recent.length === 0 &&
    changed.length === 0 &&
    attention.length === 0;

  return (
    <div className={`continuity-home-panel${className ? ` ${className}` : ""}`}>
      {isSparse ? (
        <>
          <TrustEmptyStateNote />
          <h3 className="continuity-home-headline">Living Care Record</h3>
          <p className="workspace-lede">
            Share anything that is happening — notes, messages, documents, or photos. We will help
            organize what matters.
          </p>
        </>
      ) : (
        <>
          <h3 className="continuity-home-headline">Living Care Record</h3>
          <p className="workspace-lede">
            What you have already shared is held here — so you do not have to reconstruct it from
            memory.
          </p>
        </>
      )}

      {!isSparse && (
      <section className="continuity-section">
        <h4>What is in the record so far</h4>
        <ul>
          {changed.length > 0 ? (
            changed.map((line) => <li key={line}>{line}</li>)
          ) : recent.length > 0 ? (
            recent.map((line) => <li key={line}>{line}</li>)
          ) : (
            <li className="panel-muted">No notes in this session yet.</li>
          )}
        </ul>
      </section>
      )}

      {attention.length > 0 && (
        <section className="continuity-section">
          <h4>One thing that would help</h4>
          <p className="panel-muted">Optional — only if you know.</p>
          <ul>
            {attention.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {home.recent_documents.length > 0 && (
        <section className="continuity-section">
          <h4>Documents on file</h4>
          <ul>
            {home.recent_documents.map((d) => (
              <li key={d.event_id}>{d.name}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
