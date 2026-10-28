"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ChevronDown,
  Clock3,
  History,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { ensureAnonymousSession, getJSON } from "@/api/client";

type CareEvent = {
  id: string;
  person_id: string;
  event_type: string;
  status: string;
  occurred_at: string | null;
  occurred_at_timezone?: string | null;
  recorded_at: string | null;
  updated_at?: string | null;
  title: string;
  description?: string | null;
  evidence_ids?: string[] | null;
  time_provenance?: string | null;
  tags?: string[] | null;
  created_by_caregiver_id?: string | null;
  significance_verdict?: string | null;
  attention_candidate?: boolean | null;
  follow_up_candidate?: boolean | null;
  confidence?: number | null;
  situation_id?: string | null;
  kind?: string;
  source_collection?: string;
  source_label?: string | null;
  source_type?: string | null;
  epistemic_status?: string | null;
  claim_count?: number;
  due_at?: string | null;
  correction_original?: string | null;
  correction_corrected?: string | null;
};

type LcrSource = { status?: string; items?: Record<string, unknown>[] };
type LcrContext = {
  as_of?: string;
  schema_status?: string;
  history_coverage?: string;
  missing_required_sources?: string[];
  missing_optional_sources?: string[];
  sources?: Record<string, LcrSource>;
};

type FilterKey = "all" | "observations" | "decisions" | "documents" | "open";

const FILTERS: { id: FilterKey; label: string }[] = [
  { id: "all", label: "All history" },
  { id: "observations", label: "Observations" },
  { id: "decisions", label: "Decisions" },
  { id: "documents", label: "Documents" },
  { id: "open", label: "Follow-ups & open items" },
];

function safeDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value?: string | null): string {
  const date = safeDate(value);
  if (!date) return "Time not recorded";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDay(value?: string | null): string {
  const date = safeDate(value);
  if (!date) return "Date unknown";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function eventCategory(event: CareEvent): string {
  const value = `${event.event_type} ${event.title} ${(event.tags ?? []).join(" ")}`.toLowerCase();
  if (/conflict|reconciliation|contradiction/.test(value)) return "Conflict";
  if (/decision|decided|choice/.test(value)) return "Decision";
  if (/document|upload|file|discharge|letter|report/.test(value)) return "Document";
  if (/follow.?up|open.?loop|pending|unresolved|question|appointment/.test(value) || event.follow_up_candidate) return "Follow-up";
  if (/observation|daily.?care|daily.?capture|symptom|behavio[u]?r/.test(value)) return "Observation";
  if (/correction|amend|supersed/.test(value)) return "Correction";
  if (/handoff|hand.?over|transfer/.test(value)) return "Handoff";
  if (/outcome|result|completed/.test(value)) return "Outcome";
  return event.event_type.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Care event";
}

function matchesFilter(event: CareEvent, filter: FilterKey): boolean {
  if (filter === "all") return true;
  const category = eventCategory(event).toLowerCase();
  if (filter === "observations") return category === "observation";
  if (filter === "decisions") return category === "decision";
  if (filter === "documents") return category === "document";
  return category === "follow-up" || Boolean(event.follow_up_candidate) || Boolean(event.attention_candidate);
}

function parseDescription(description?: string | null): string {
  if (!description?.trim()) return "";
  try {
    const parsed: unknown = JSON.parse(description);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.entries(parsed as Record<string, unknown>)
        .filter(([, value]) => value !== null && value !== undefined && value !== "")
        .map(([key, value]) => `${key.replaceAll("_", " ")}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
        .join("\n");
    }
  } catch {
    // Preserve plain-text descriptions as entered.
  }
  return description;
}

function displayEventDate(event: CareEvent): string {
  if (event.due_at) {
    const due = safeDate(event.due_at);
    return due ? `Due ${formatDateTime(event.due_at)}` : "Due date unavailable";
  }
  if (event.occurred_at) return formatDateTime(event.occurred_at);
  return event.recorded_at ? `Recorded ${formatDateTime(event.recorded_at)}` : "Date not recorded";
}

function groupLabel(event: CareEvent): string {
  return formatDay(event.occurred_at ?? event.recorded_at);
}

function firstText(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (value && typeof value === "object") return JSON.stringify(value) ?? null;
  }
  return null;
}

function mapHistorySource(sourceName: string, row: Record<string, unknown>, personId: string): CareEvent | null {
  const rawId = firstText(row, ["id"]);
  if (!rawId) return null;
  const occurredAt = firstText(row, ["occurred_at", "observed_at", "effective_at", "decided_at", "scheduled_at"]);
  const recordedAt = firstText(row, ["recorded_at", "created_at", "uploaded_at", "asked_at", "assessed_at", "reviewed_at"]);
  const evidenceIds = Array.isArray(row.evidence_ids)
    ? row.evidence_ids.filter((value): value is string => typeof value === "string")
    : Array.isArray(row.source_ids)
      ? row.source_ids.filter((value): value is string => typeof value === "string")
      : [];
  const status = firstText(row, ["status", "lifecycle_status", "reconciliation_status", "assertion_status", "decision_status", "evidence_status", "epistemic_status", "epistemic_state"]) ?? "not_specified";
  const title = firstText(row, ["title", "topic", "question", "conflict_type", "fact_type", "field", "observation_category", "follow_up_kind", "entry_type", "event_type", "type", "context_type", "target_type", "subject_type", "source_label"]) ?? sourceName.replaceAll("_", " ");
  let description = firstText(row, ["description", "fact_value", "asserted_value", "decision_text", "perspective_text", "source_text", "notes", "answer", "resolution", "summary", "decision_notes", "resolution_notes", "context_payload"]);
  const original = firstText(row, ["original_text", "original_value"]);
  const corrected = firstText(row, ["corrected_text", "corrected_value"]);
  if (sourceName === "corrections" && (original || corrected)) {
    description = [original ? `Earlier information: ${original}` : "", corrected ? `Correction: ${corrected}` : "", firstText(row, ["reason"]) ? `Reason: ${firstText(row, ["reason"])}` : ""].filter(Boolean).join("\\n");
  }
  const claimRefs = Array.isArray(row.claim_refs) ? row.claim_refs : Array.isArray(row.competing_claim_ids) ? row.competing_claim_ids : [];
  const isOpenWork = ["conflicts", "reconciliations", "uncertainties", "missing_information", "information_gaps", "open_questions", "follow_up_links"].includes(sourceName);
  return {
    id: `${sourceName}:${rawId}`,
    person_id: personId,
    event_type: firstText(row, ["event_type", "entry_type", "type", "follow_up_kind"]) ?? sourceName,
    status,
    occurred_at: occurredAt,
    recorded_at: recordedAt,
    updated_at: firstText(row, ["updated_at"]),
    title,
    description,
    evidence_ids: evidenceIds,
    time_provenance: firstText(row, ["time_provenance", "source_type", "epistemic_status", "epistemic_state"]),
    tags: [sourceName],
    created_by_caregiver_id: null,
    significance_verdict: firstText(row, ["significance_verdict", "resolution", "decision_notes"]),
    attention_candidate: isOpenWork && !["resolved", "completed", "closed", "reconciled", "withdrawn", "retracted", "superseded", "cancelled"].includes(status.toLowerCase()),
    follow_up_candidate: ["follow_up_links", "open_questions", "information_gaps", "missing_information"].includes(sourceName),
    situation_id: null,
    kind: sourceName === "conflicts" ? "Conflict" : sourceName === "reconciliations" ? "Reconciliation review" : sourceName.replaceAll("_", " "),
    source_collection: sourceName,
    source_label: firstText(row, ["source_label", "author_label", "source_type"]) ?? "Source label not recorded",
    source_type: firstText(row, ["source_type"]) ?? "not_recorded",
    epistemic_status: firstText(row, ["epistemic_status", "epistemic_state", "assertion_status", "decision_status"]),
    claim_count: claimRefs.length,
    due_at: firstText(row, ["due_at"]),
    correction_original: original,
    correction_corrected: corrected,
  };
}

function mapLcrHistory(context: LcrContext, personId: string): CareEvent[] {
  const sources = context.sources ?? {};
  const historySources = [
    "events", "evidence", "facts", "assertions", "decisions", "decision_outcomes", "timeline",
    "uncertainties", "missing_information", "information_gaps", "conflicts", "reconciliations",
    "open_questions", "follow_up_links", "provenance", "caregiver_observations", "caregiver_contexts",
    "caregiver_perspectives", "corrections", "appointments",
  ];
  const result: CareEvent[] = [];
  for (const sourceName of historySources) {
    for (const row of sources[sourceName]?.items ?? []) {
      const mapped = mapHistorySource(sourceName, row, personId);
      if (mapped) result.push(mapped);
    }
  }
  const unique = new Map<string, CareEvent>();
  for (const item of result) unique.set(item.id, item);
  return [...unique.values()].sort((a, b) => {
    const aTime = safeDate(a.occurred_at)?.getTime() ?? safeDate(a.recorded_at)?.getTime() ?? Number.NEGATIVE_INFINITY;
    const bTime = safeDate(b.occurred_at)?.getTime() ?? safeDate(b.recorded_at)?.getTime() ?? Number.NEGATIVE_INFINITY;
    return bTime - aTime;
  });
}

function mapRevisionHistory(row: Record<string, unknown>, personId: string): CareEvent | null {
  const targetId = firstText(row, ["target_id"]);
  const revisionType = firstText(row, ["revision_type"]) ?? "record_revision";
  const revisionNumber = firstText(row, ["revision_number", "version_number"]);
  const changedAt = firstText(row, ["changed_at", "created_at"]);
  if (!targetId && !changedAt) return null;
  const original = firstText(row, ["previous_value", "old_value", "before_state", "original_value"]);
  const corrected = firstText(row, ["new_value", "current_value", "after_state", "corrected_value"]);
  const reason = firstText(row, ["reason", "change_reason", "revision_notes", "change_summary"]);
  const description = [
    original ? `Earlier value: ${original}` : "",
    corrected ? `Revised value: ${corrected}` : "",
    reason ?? "A record revision was retained in the longitudinal history.",
  ].filter(Boolean).join("\\n");
  return {
    id: `record_revisions:${revisionType}:${targetId ?? changedAt}:${revisionNumber ?? "saved"}`,
    person_id: personId,
    event_type: "correction",
    status: firstText(row, ["status"]) ?? "revision_recorded",
    occurred_at: null,
    recorded_at: changedAt,
    title: `Record revision · ${revisionType.replaceAll("_", " ")}${revisionNumber ? ` #${revisionNumber}` : ""}`,
    description,
    evidence_ids: Array.isArray(row.evidence_ids) ? row.evidence_ids.filter((value): value is string => typeof value === "string") : [],
    time_provenance: "record_revision",
    tags: ["record_revisions"],
    source_collection: "record_revisions",
    source_label: "SolenOS record revision",
    source_type: revisionType,
    epistemic_status: firstText(row, ["epistemic_status"]),
    claim_count: 0,
    correction_original: original,
    correction_corrected: corrected,
  };
}

function mapVersionHistory(row: Record<string, unknown>, personId: string): CareEvent | null {
  const versionId = firstText(row, ["id", "version_id", "version_number"]);
  const createdAt = firstText(row, ["created_at"]);
  if (!versionId && !createdAt) return null;
  const versionNumber = firstText(row, ["version_number", "version"]);
  return {
    id: `record_versions:${versionId ?? createdAt}`,
    person_id: personId,
    event_type: "record_version",
    status: firstText(row, ["status", "version_status"]) ?? "version_saved",
    occurred_at: null,
    recorded_at: createdAt,
    title: versionNumber ? `Care record version ${versionNumber}` : "Care record version saved",
    description: firstText(row, ["change_summary", "summary", "reason"]) ?? "A version of the care record was saved. The version metadata is retained in the record history.",
    evidence_ids: Array.isArray(row.evidence_ids) ? row.evidence_ids.filter((value): value is string => typeof value === "string") : [],
    time_provenance: "record_version",
    tags: ["record_versions"],
    source_collection: "record_versions",
    source_label: "SolenOS record version",
    source_type: firstText(row, ["version_type"]) ?? "record_version",
    epistemic_status: null,
    claim_count: 0,
  };
}

export default function TimelinePage() {
  const router = useRouter();
  const [events, setEvents] = useState<CareEvent[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [coverageNotice, setCoverageNotice] = useState<string | null>(null);

  const loadEvents = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const session = await ensureAnonymousSession();
      if (!session.person?.id || !session.access_token) {
        throw new Error("A valid SolenOS care session is required to load this record.");
      }
      const result = await getJSON("/care-continuity/context?limit_per_source=50");
      if (!result || typeof result !== "object" || !("sources" in result)) {
        throw new Error("The longitudinal care history response was incomplete. No history has been assumed.");
      }
      const context = result as LcrContext;
      setEvents(mapLcrHistory(context, session.person.id));
      const missingRequired = context.missing_required_sources ?? [];
      const missingOptional = context.missing_optional_sources ?? [];
      setCoverageNotice(
        context.schema_status !== "complete" || missingRequired.length > 0 || missingOptional.length > 0
          ? `This history may be incomplete. Required sources unavailable: ${missingRequired.length}; additional sources unavailable: ${missingOptional.length}. The missing information has not been filled in.`
          : null
      );
      setLoadedAt(new Date().toISOString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The care timeline could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const visibleEvents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      if (!matchesFilter(event, filter)) return false;
      if (!needle) return true;
      const haystack = [
        event.title,
        event.event_type,
        event.description ?? "",
        event.status,
        ...(event.tags ?? []),
        ...(event.evidence_ids ?? []),
      ].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [events, filter, query]);

  const groupedEvents = useMemo(() => {
    const groups: { label: string; events: CareEvent[] }[] = [];
    for (const event of visibleEvents) {
      const label = groupLabel(event);
      const last = groups[groups.length - 1];
      if (last?.label === label) last.events.push(event);
      else groups.push({ label, events: [event] });
    }
    return groups;
  }, [visibleEvents]);

  const latestEvent = events[0] ?? null;

  return (
    <main className="mobile-screen" style={{ maxWidth: 920, margin: "0 auto", paddingBottom: 48 }}>
      <header className="mobile-page-head" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <p style={{ margin: "0 0 6px", color: "var(--solenos-muted)", fontSize: 13, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>Living Care Record</p>
          <h1 style={{ marginBottom: 8 }}>Longitudinal Care History</h1>
          <p style={{ marginTop: 0, maxWidth: 620 }}>A chronological view of saved observations, documents, claims, decisions, corrections, and follow-ups. Earlier reports remain part of the record even when understanding changes.</p>
        </div>
        <Button variant="icon" aria-label="Refresh timeline" disabled={loading || refreshing} onClick={() => void loadEvents(true)}>
          <RefreshCw size={18} aria-hidden />
        </Button>
      </header>

      {coverageNotice && <section role="status" style={{ border: "1px solid var(--solenos-hairline)", borderRadius: 12, padding: 14, marginBottom: 16, background: "var(--paper)" }}><p style={{ margin: 0, lineHeight: 1.5 }}>{coverageNotice}</p></section>}

      <section aria-label="Latest recorded event" style={{ border: "1px solid var(--solenos-hairline)", borderRadius: 16, background: "white", padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <History size={19} aria-hidden />
          <h2 style={{ fontSize: 18, margin: 0 }}>Latest history entry</h2>
        </div>
        {loading ? (
          <p aria-live="polite" style={{ margin: 0, color: "var(--solenos-muted)" }}>Loading saved care history…</p>
        ) : error ? (
          <p style={{ margin: 0, color: "var(--solenos-muted)" }}>The latest entry is unavailable until the history loads successfully.</p>
        ) : latestEvent ? (
          <>
            <h3 style={{ margin: "0 0 6px", fontSize: 18 }}>{latestEvent.title}</h3>
            <p style={{ margin: "0 0 8px", color: "var(--solenos-muted)" }}>{displayEventDate(latestEvent)} · {eventCategory(latestEvent)}</p>
            <p style={{ margin: 0, lineHeight: 1.55 }}>{parseDescription(latestEvent.description) || "No event description was saved."}</p>
          </>
        ) : (
          <p style={{ margin: 0, lineHeight: 1.55 }}>No saved history entries were returned for this record. This does not mean there are no care needs.</p>
        )}
        <p style={{ margin: "12px 0 0", color: "var(--solenos-muted)", fontSize: 12 }}>This is the latest saved event, not a substitute for the reconciled current-care view in the LCR.</p>
      </section>

      <section aria-label="Timeline controls" style={{ marginBottom: 20 }}>
        <label htmlFor="timeline-search" style={{ display: "block", fontWeight: 650, marginBottom: 8 }}>Search the care history</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--solenos-hairline)", background: "white", borderRadius: 12, padding: "0 12px", minHeight: 48 }}>
          <Search size={18} aria-hidden />
          <input id="timeline-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search care information, notes, sources, and evidence references…" style={{ border: 0, outline: 0, flex: 1, minWidth: 0, padding: "12px 0", background: "transparent", color: "inherit", font: "inherit" }} />
        </div>
        <div role="group" aria-label="Filter timeline events" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {FILTERS.map((item) => {
            const active = filter === item.id;
            return (
              <button key={item.id} type="button" aria-pressed={active} onClick={() => setFilter(item.id)} style={{ border: "1px solid var(--solenos-hairline)", borderRadius: 999, padding: "9px 13px", minHeight: 40, background: active ? "#e4ede5" : "white", color: "#172b35", font: "inherit", fontWeight: active ? 700 : 500, cursor: "pointer" }}>
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <section role="alert" style={{ border: "1px solid #d8a7a7", borderRadius: 12, padding: 16, marginBottom: 20, background: "#fff8f8" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <AlertCircle size={20} aria-hidden />
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 16, margin: "0 0 6px" }}>Timeline could not be loaded</h2>
              <p style={{ margin: "0 0 12px", overflowWrap: "anywhere" }}>{error}</p>
              <Button variant="primary" onClick={() => void loadEvents(true)} disabled={refreshing}>Try again</Button>
            </div>
          </div>
        </section>
      )}

      {loading ? (
        <p aria-live="polite">Loading chronological history…</p>
      ) : !error && visibleEvents.length === 0 ? (
        <section className="mobile-empty" style={{ padding: 28 }}>
          <div className="mobile-empty-icon" aria-hidden="true"><Activity size={36} /></div>
          <h2 className="mobile-empty-title">{events.length ? "No matching events" : "Your timeline starts with real records"}</h2>
          <p className="mobile-empty-body">{events.length ? "Try another filter or search term. No records were removed." : "SolenOS will show care events here after they have been saved to the backend. This screen never inserts example care history."}</p>
          <div className="mobile-empty-actions" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Button variant="primary" onClick={() => router.push("/workspace/daily-care")}>Open Daily Care</Button>
            {(query || filter !== "all") && <Button variant="secondary" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</Button>}
          </div>
        </section>
      ) : (
        <section aria-label="Chronological care history">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <h2 style={{ fontSize: 19, margin: 0 }}>History</h2>
            <span style={{ color: "var(--solenos-muted)", fontSize: 13 }}>{visibleEvents.length} {visibleEvents.length === 1 ? "entry" : "entries"}</span>
          </div>
          {groupedEvents.map((group) => (
            <div key={group.label} style={{ marginBottom: 22 }}>
              <h3 style={{ fontSize: 13, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--solenos-muted)", margin: "18px 0 12px" }}>{group.label}</h3>
              <div style={{ borderLeft: "2px solid var(--solenos-hairline)", marginLeft: 8, paddingLeft: 18, display: "grid", gap: 12 }}>
                {group.events.map((event) => {
                  const expanded = expandedId === event.id;
                  const category = eventCategory(event);
                  const description = parseDescription(event.description);
                  return (
                    <article key={event.id} style={{ position: "relative", border: "1px solid var(--solenos-hairline)", borderRadius: 14, background: "white", overflow: "hidden" }}>
                      <span aria-hidden="true" style={{ position: "absolute", width: 10, height: 10, borderRadius: "50%", background: "#64866b", left: -24, top: 22, boxShadow: "0 0 0 4px var(--paper)" }} />
                      <button type="button" aria-expanded={expanded} aria-controls={`timeline-details-${event.id}`} onClick={() => setExpandedId(expanded ? null : event.id)} style={{ width: "100%", textAlign: "left", border: 0, background: "transparent", padding: 16, display: "block", color: "inherit", cursor: "pointer", font: "inherit" }}>
                        <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, background: "#e4ede5", borderRadius: 999, padding: "5px 9px" }}><Clock3 size={13} aria-hidden />{category}</span>
                          <span style={{ color: "var(--solenos-muted)", fontSize: 12 }}>{displayEventDate(event)}</span>
                          {event.follow_up_candidate && <span style={{ fontSize: 12, fontWeight: 650 }}>Follow-up flagged</span>}
                          {event.attention_candidate && <span style={{ fontSize: 12, fontWeight: 650 }}>Attention flagged</span>}
                          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--solenos-muted)" }}>{expanded ? "Hide details" : "Details"} <ChevronDown size={16} aria-hidden style={{ transform: expanded ? "rotate(180deg)" : undefined }} /></span>
                        </span>
                        <strong style={{ display: "block", fontSize: 17, lineHeight: 1.4, marginBottom: 5 }}>{event.title}</strong>
                        {description && <span style={{ display: "-webkit-box", WebkitLineClamp: expanded ? "unset" : 2, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-wrap", lineHeight: 1.5, overflowWrap: "anywhere" }}>{description}</span>}
                      </button>
                      {expanded && (
                        <div id={`timeline-details-${event.id}`} style={{ borderTop: "1px solid var(--solenos-hairline)", padding: 16, background: "#fbfcfc" }}>
                          <h4 style={{ margin: "0 0 10px", fontSize: 14 }}>Record details</h4>
                          <dl style={{ display: "grid", gridTemplateColumns: "minmax(110px, 0.7fr) minmax(0, 1.3fr)", gap: "9px 12px", margin: 0, fontSize: 13 }}>
                            <dt style={{ color: "var(--solenos-muted)" }}>Event time</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{formatDateTime(event.occurred_at)}{event.occurred_at_timezone ? ` (${event.occurred_at_timezone})` : ""}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Recorded in SolenOS</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{formatDateTime(event.recorded_at)}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Record status</dt><dd style={{ margin: 0 }}>{event.status || "Not specified"}</dd>
                            {event.epistemic_status && <><dt style={{ color: "var(--solenos-muted)" }}>Information status</dt><dd style={{ margin: 0 }}>{event.epistemic_status}</dd></>}
                            {(event.kind === "Conflict" || event.kind === "Reconciliation review") && typeof event.claim_count === "number" && <><dt style={{ color: "var(--solenos-muted)" }}>Claims retained</dt><dd style={{ margin: 0 }}>{event.claim_count}</dd></>}
                            {event.correction_original && <><dt style={{ color: "var(--solenos-muted)" }}>Earlier information</dt><dd style={{ margin: 0, whiteSpace: "pre-wrap" }}>{event.correction_original}</dd></>}
                            {event.correction_corrected && <><dt style={{ color: "var(--solenos-muted)" }}>Correction</dt><dd style={{ margin: 0, whiteSpace: "pre-wrap" }}>{event.correction_corrected}</dd></>}
                            <dt style={{ color: "var(--solenos-muted)" }}>Time provenance</dt><dd style={{ margin: 0 }}>{event.time_provenance || "Not recorded"}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Source attribution</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{event.source_label || "Source label not recorded"}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Source type</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{event.source_type || event.source_collection || "Not recorded"}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Situation link</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{event.situation_id ? "Linked care situation" : "No linked situation recorded"}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Evidence references</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{event.evidence_ids?.length ? `${event.evidence_ids.length} linked evidence item(s)` : "No evidence references attached to this entry"}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Tags</dt><dd style={{ margin: 0 }}>{event.tags?.length ? event.tags.join(", ") : "No tags recorded"}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Updated</dt><dd style={{ margin: 0 }}>{formatDateTime(event.updated_at)}</dd>
                          </dl>
                          {event.significance_verdict && <p style={{ margin: "12px 0 0" }}><strong>Recorded significance:</strong> {event.significance_verdict}</p>}
                          <p style={{ margin: "12px 0 0", color: "var(--solenos-muted)", fontSize: 12 }}>This entry shows persisted event fields. Missing metadata is displayed as missing, not inferred. Corrections and original-document viewing are only offered where the backend provides a verified workflow.</p>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      <footer style={{ marginTop: 28, paddingTop: 14, borderTop: "1px solid var(--solenos-hairline)", color: "var(--solenos-muted)", fontSize: 12, display: "flex", alignItems: "flex-start", gap: 8 }}>
        <ShieldCheck size={16} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
        <span>History is ordered by event time where available; entries without an event time are ordered by recording time. Source attribution and uncertainty remain distinct. This view does not turn AI interpretation into a care fact or claim that one event caused another.{loadedAt ? ` Last loaded ${formatDateTime(loadedAt)}.` : ""}</span>
      </footer>
    </main>
  );
}
