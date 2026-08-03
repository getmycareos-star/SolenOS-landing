"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { TIMELINE_ENTRY_TYPES, type TimelineEntry } from "@/lib/ui-runtime";

const TYPE_LABELS: Record<string, string> = {
  situation_created: "New situation",
  situation_updated: "Updated",
  observation_added: "Observation",
  decision_recorded: "Decision recorded",
  note_added: "Note added",
  system_event: "System",
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function TimelinePage() {
  const { runtime } = useWorkspace();
  const entries = useMemo(() => runtime.timeline.entries, [runtime.timeline]);

  if (entries.length === 0) {
    return (
      <div className="timeline-page">
        <h1 className="page-title">Care Timeline</h1>
        <p className="page-lede">
          A chronological view of every care event, observation, and decision in the Living Care Record.
        </p>
        <div className="empty-state">
          <div className="empty-state-icon">◷</div>
          <h2 className="empty-state-title">No timeline yet</h2>
          <p className="empty-state-body">
            Your care timeline will appear here as you add situations and observations.
          </p>
          <Link href="/workspace" className="settings-button settings-button--primary">
            Add your first care note
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-page">
      <h1 className="page-title">Care Timeline</h1>
      <p className="page-lede">
        A chronological view of every care event, observation, and decision in the Living Care Record.
      </p>
      <div className="page-actions">
        <Link href="/workspace" className="settings-button settings-button--primary">
          Add record
        </Link>
      </div>
      <div className="timeline-list">
        {entries.map((entry: TimelineEntry) => (
          <div key={entry.id} className="timeline-entry">
            <div className="timeline-entry-marker" aria-hidden="true" />
            <div className="timeline-entry-body">
              <div className="timeline-entry-time">
                {formatTime(entry.timestamp)}
              </div>
              <h3 className="timeline-entry-title">
                {TYPE_LABELS[entry.type] ?? entry.type}
              </h3>
              <p className="timeline-entry-summary">{entry.summary}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
