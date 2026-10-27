"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Clock, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/lib/workspace-context";
import { getJSON } from "@/api/client";
import type { TimelineEntry } from "@/lib/ui-runtime";

type Row = Record<string, unknown>;
type TimelineItem = {
  id: string;
  title: string;
  summary: string;
  timestamp: string;
  recordedAt?: string;
  epistemicStatus?: string;
  sourceType?: string;
  sourceId?: string;
  evidenceIds?: unknown;
  isProjection?: boolean;
  origin: "saved record" | "current workspace";
};

const TYPE_LABELS: Record<string, string> = {
  situation_created: "New situation",
  situation_updated: "Updated situation",
  observation_added: "Observation",
  decision_recorded: "Decision recorded",
  note_added: "Care note",
  system_event: "System event",
};

function formatTime(iso: string): string {
  if (!iso) return "Time not recorded";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toSavedTimelineItem(row: Row): TimelineItem {
  const title = String(row.title ?? row.entry_type ?? row.source_type ?? "Care record change");
  return {
    id: String(row.id ?? `${row.source_type ?? "record"}:${row.source_id ?? title}:${row.recorded_at ?? ""}`),
    title,
    summary: String(row.summary ?? ""),
    timestamp: String(row.occurred_at ?? row.effective_from ?? row.recorded_at ?? row.created_at ?? ""),
    recordedAt: row.recorded_at ? String(row.recorded_at) : undefined,
    epistemicStatus: row.epistemic_status ? String(row.epistemic_status) : undefined,
    sourceType: row.source_type ? String(row.source_type) : undefined,
    sourceId: row.source_id ? String(row.source_id) : undefined,
    evidenceIds: row.evidence_ids,
    isProjection: Boolean(row.is_projection),
    origin: "saved record",
  };
}

export default function TimelinePage() {
  const router = useRouter();
  const { runtime } = useWorkspace();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savedRows, setSavedRows] = useState<Row[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    getJSON("/care-continuity/timeline?limit=100")
      .then((rows) => {
        if (!active) return;
        setSavedRows(Array.isArray(rows) ? rows as Row[] : []);
        setLoadError("");
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Saved timeline is temporarily unavailable.");
      });
    return () => { active = false; };
  }, []);

  const entries = useMemo(() => {
    const localItems: TimelineItem[] = runtime.timeline.entries.map((entry: TimelineEntry) => ({
      id: `workspace:${entry.id}`,
      title: TYPE_LABELS[entry.type] ?? entry.type,
      summary: entry.summary,
      timestamp: entry.timestamp,
      epistemicStatus: "workspace entry",
      origin: "current workspace" as const,
    }));
    const savedItems = savedRows.map(toSavedTimelineItem);
    // A true chronological record: earliest first, with occurrence/effective time
    // used for ordering and recorded_at kept visible as a separate timestamp.
    return [...localItems, ...savedItems].sort((a, b) => {
      const at = Date.parse(a.timestamp);
      const bt = Date.parse(b.timestamp);
      if (!Number.isFinite(at) && !Number.isFinite(bt)) return a.id.localeCompare(b.id);
      if (!Number.isFinite(at)) return 1;
      if (!Number.isFinite(bt)) return -1;
      return at - bt;
    });
  }, [runtime.timeline, savedRows]);

  return (
    <div className="mobile-screen">
      <div className="mobile-page-head">
        <h1>Living Care Record Timeline</h1>
        <p>Chronological care changes, the evidence behind them, and what remains uncertain.</p>
      </div>

      {loadError && (
        <p role="status" style={{ margin: "0 0 16px", padding: 12, border: "1px solid var(--border, #d7ddd7)", borderRadius: 10 }}>
          Saved timeline could not be loaded: {loadError}. Workspace entries remain visible.
        </p>
      )}

      {entries.length === 0 ? (
        <div className="mobile-empty">
          <div className="mobile-empty-icon" aria-hidden="true"><Clock size={40} /></div>
          <h2 className="mobile-empty-title">No timeline entries yet</h2>
          <p className="mobile-empty-body">Saved care events and reviewed changes will appear here as the record grows.</p>
          <div className="mobile-empty-actions">
            <Button variant="primary" onClick={() => router.push("/workspace?compose=1")}>
              <Plus size={18} aria-hidden />
              Add a care note
            </Button>
          </div>
        </div>
      ) : (
        <div className="mobile-timeline">
          <div className="mobile-timeline-rail">
            {entries.map((entry) => {
              const isExpanded = expandedId === entry.id;
              return (
                <div key={entry.id} className={`mobile-timeline-item${isExpanded ? " is-expanded" : ""}`}>
                  <span className="mobile-timeline-dot" aria-hidden="true" />
                  <button
                    type="button"
                    className="mobile-timeline-card"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  >
                    <span className="mobile-timeline-card-header">
                      <span className="mobile-timeline-icon" aria-hidden="true"><Clock size={16} /></span>
                      <span className="mobile-timeline-label">{entry.title}</span>
                      <span className="mobile-timeline-time">{formatTime(entry.timestamp)}</span>
                    </span>
                    <span className="mobile-timeline-summary-wrap">
                      <span className="mobile-timeline-summary-inner">
                        <span className="mobile-timeline-summary">{entry.summary || "No additional summary was recorded."}</span>
                      </span>
                    </span>
                    {isExpanded && (
                      <span style={{ display: "grid", gap: 6, padding: "10px 0 2px", textAlign: "left", overflowWrap: "anywhere" }}>
                        <span><strong>Record source:</strong> {entry.origin}</span>
                        {entry.sourceType && <span><strong>Source type:</strong> {entry.sourceType}</span>}
                        {entry.sourceId && <span><strong>Source reference:</strong> {entry.sourceId}</span>}
                        {entry.recordedAt && <span><strong>Recorded in SolenOS:</strong> {formatTime(entry.recordedAt)}</span>}
                        {entry.epistemicStatus && <span><strong>Status:</strong> {entry.epistemicStatus}</span>}
                        {entry.isProjection && <span>This is a timeline projection linked to a source record, not a replacement for that source.</span>}
                        {entry.evidenceIds !== undefined && <span><strong>Evidence references:</strong> {typeof entry.evidenceIds === "string" ? entry.evidenceIds : JSON.stringify(entry.evidenceIds)}</span>}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, fontSize: 12, opacity: 0.8 }}>
        <ShieldCheck size={16} /> Timeline entries are read from the active session's care record. Reported information is not automatically treated as verified fact.
      </p>
    </div>
  );
}
