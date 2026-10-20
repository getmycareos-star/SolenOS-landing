"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Clock } from "lucide-react";

import { Button } from "@/components/ui/Button";
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
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function TimelinePage() {
  const router = useRouter();
  const { runtime } = useWorkspace();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const entries = useMemo(() => [...runtime.timeline.entries].reverse(), [runtime.timeline]);

  if (entries.length === 0) {
    return (
      <div className="mobile-screen">
        <div className="mobile-page-head">
          <h1>Timeline</h1>
          <p>Every care event, observation, and decision in the record.</p>
        </div>
        <div className="mobile-empty">
          <div className="mobile-empty-icon" aria-hidden="true">
            <Clock size={40} />
          </div>
          <h2 className="mobile-empty-title">No timeline yet</h2>
          <p className="mobile-empty-body">
            Your care timeline will appear here as you add notes and observations.
          </p>
          <div className="mobile-empty-actions">
            <Button variant="primary" onClick={() => router.push("/workspace?compose=1")}>
              <Plus size={18} aria-hidden />
              Add a care note
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-screen">
      <div className="mobile-page-head">
        <h1>Timeline</h1>
        <p>Every care event, observation, and decision in the record.</p>
      </div>
      <div className="mobile-timeline">
        <div className="mobile-timeline-rail">
          {entries.map((entry: TimelineEntry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <div
                key={entry.id}
                className={`mobile-timeline-item${isExpanded ? " is-expanded" : ""}`}
              >
                <span className="mobile-timeline-dot" aria-hidden="true" />
                <button
                  type="button"
                  className="mobile-timeline-card"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <span className="mobile-timeline-card-header">
                    <span className="mobile-timeline-icon" aria-hidden="true">
                      <Clock size={16} />
                    </span>
                    <span className="mobile-timeline-label">
                      {TYPE_LABELS[entry.type] ?? entry.type}
                    </span>
                    <span className="mobile-timeline-time">
                      {formatTime(entry.timestamp)}
                    </span>
                    <ChevronDown size={16} className="mobile-timeline-chevron" aria-hidden />
                  </span>
                  <span className="mobile-timeline-summary-wrap">
                    <span className="mobile-timeline-summary-inner">
                      <span className="mobile-timeline-summary">{entry.summary}</span>
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

