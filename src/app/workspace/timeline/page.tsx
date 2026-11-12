"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ChevronDown,
  Clock3,
  History,
  Plus,
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
  occurred_at?: string | null;
  occurred_at_timezone?: string | null;
  recorded_at?: string | null;
  uploaded_at?: string | null;
  updated_at?: string | null;
  title: string;
  description?: string | null;
  evidence_ids?: string[] | null;
  time_provenance?: string | null;
  tags?: string[] | null;
  created_by_caregiver_id?: string | null;
  source_type?: string | null;
  source_label?: string | null;
  original_text?: string | null;
  corrected_text?: string | null;
  reason?: string | null;
  significance_verdict?: string | null;
  attention_candidate?: boolean | null;
  follow_up_candidate?: boolean | null;
  confidence?: number | null;
  situation_id?: string | null;
};

type FilterKey = "all" | "observations" | "decisions" | "documents" | "open";

const FILTERS: { id: FilterKey; label: string }[] = [
  { id: "all", label: "All events" },
  { id: "observations", label: "Observations" },
  { id: "decisions", label: "Decisions" },
  { id: "documents", label: "Documents" },
  { id: "open", label: "Follow-ups & open items" },
];

function mapHistoryRecord(value: unknown, personId: string): CareEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const sourceType = typeof row.source_type === "string" ? row.source_type : "care_record";
  const idValue = typeof row.source_id === "string" ? row.source_id : typeof row.id === "string" ? row.id : "";
  if (!idValue) return null;

  const originalText = typeof row.original_text === "string" ? row.original_text : undefined;
  const correctedText = typeof row.corrected_text === "string" ? row.corrected_text : undefined;
  const reason = typeof row.reason === "string" ? row.reason : undefined;
  const description = sourceType === "correction"
    ? [
        originalText ? `Earlier entry: ${originalText}` : "",
        correctedText ? `Correction: ${correctedText}` : "",
        reason ? `Reason: ${reason}` : "",
      ].filter(Boolean).join("\n")
    : typeof row.text === "string" ? row.text
      : typeof row.description === "string" ? row.description
        : typeof row.source_text === "string" ? row.source_text : "";

  const eventType = typeof row.event_type === "string"
    ? row.event_type
    : sourceType === "evidence" ? "evidence_upload"
      : sourceType === "appointment" ? "appointment"
        : sourceType;
  const title = typeof row.title === "string" && row.title.trim()
    ? row.title
    : sourceType === "correction" ? "Care record correction"
      : sourceType === "evidence" ? `Evidence: ${String(row.evidence_type || "uploaded file")}`
        : sourceType === "appointment" ? "Appointment"
          : sourceType.replace(/_/g, " ");

  return {
    id: idValue,
    person_id: typeof row.person_id === "string" ? row.person_id : personId,
    event_type: eventType,
    status: typeof row.status === "string" ? row.status : typeof row.epistemic_status === "string" ? row.epistemic_status : "Not specified",
    occurred_at: typeof row.occurred_at === "string" ? row.occurred_at
      : typeof row.event_time === "string" ? row.event_time
        : typeof row.observed_at === "string" ? row.observed_at
          : typeof row.scheduled_at === "string" ? row.scheduled_at
            : typeof row.uploaded_at === "string" ? row.uploaded_at
              : typeof row.recorded_at === "string" ? row.recorded_at : null,
    recorded_at: typeof row.recorded_at === "string" ? row.recorded_at
      : typeof row.uploaded_at === "string" ? row.uploaded_at
        : typeof row.created_at === "string" ? row.created_at : null,
    uploaded_at: typeof row.uploaded_at === "string" ? row.uploaded_at : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
    title,
    description,
    evidence_ids: Array.isArray(row.evidence_ids) ? row.evidence_ids.filter((item): item is string => typeof item === "string") : [],
    time_provenance: typeof row.time_provenance === "string" ? row.time_provenance : null,
    tags: Array.isArray(row.tags) ? row.tags.filter((item): item is string => typeof item === "string") : [],
    created_by_caregiver_id: typeof row.created_by_caregiver_id === "string" ? row.created_by_caregiver_id : null,
    source_type: sourceType,
    source_label: typeof row.source_label === "string" ? row.source_label : null,
    original_text: originalText,
    corrected_text: correctedText,
    reason,
    significance_verdict: typeof row.significance_verdict === "string" ? row.significance_verdict : null,
    attention_candidate: row.attention_candidate === true,
    follow_up_candidate: row.follow_up_candidate === true,
    confidence: typeof row.confidence === "number" ? row.confidence : null,
    situation_id: typeof row.situation_id === "string" ? row.situation_id : null,
  };
}

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

function groupLabel(event: CareEvent): string {
  return formatDay(event.occurred_at);
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
  const [historyCoverage, setHistoryCoverage] = useState<{ hasMore: boolean; total: number }>({ hasMore: false, total: 0 });

  const loadEvents = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const session = await ensureAnonymousSession();
      if (!session.person?.id || !session.access_token) {
        throw new Error("A valid SolenOS care session is required to load this record.");
      }
      const result = await getJSON("/daily-care/intelligence/history?limit=200&offset=0") as {
        records?: unknown;
        page?: { has_more?: boolean; total_matching?: number };
      };
      if (!Array.isArray(result?.records)) {
        throw new Error("The care history response was not in the expected format. No events have been assumed.");
      }
      const validEvents = result.records
        .map((item) => mapHistoryRecord(item, session.person!.id))
        .filter((item): item is CareEvent => item !== null);
      setEvents(validEvents.sort((a, b) => {
        const aTime = safeDate(a.occurred_at)?.getTime() ?? safeDate(a.recorded_at)?.getTime() ?? Number.NEGATIVE_INFINITY;
        const bTime = safeDate(b.occurred_at)?.getTime() ?? safeDate(b.recorded_at)?.getTime() ?? Number.NEGATIVE_INFINITY;
        if (aTime !== bTime) return bTime - aTime;
        return (safeDate(b.recorded_at)?.getTime() ?? 0) - (safeDate(a.recorded_at)?.getTime() ?? 0);
      }));
      setHistoryCoverage({
        hasMore: Boolean(result.page?.has_more),
        total: typeof result.page?.total_matching === "number" ? result.page.total_matching : validEvents.length,
      });
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
        event.source_type ?? "",
        event.source_label ?? "",
        event.original_text ?? "",
        event.corrected_text ?? "",
        event.reason ?? "",
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
    <main className="mobile-screen timeline-workspace" style={{ maxWidth: 920, margin: "0 auto", paddingBottom: 48 }}>
      <header className="mobile-page-head" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <p style={{ margin: "0 0 6px", color: "var(--solenos-muted)", fontSize: 13, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>Living Care Record</p>
          <h1 style={{ marginBottom: 8 }}>Care Timeline</h1>
          <p style={{ marginTop: 0, maxWidth: 620 }}>A chronological, source-linked history of recorded care events. Historical reports remain distinct from the current care understanding.</p>
        </div>
        <Button variant="icon" aria-label="Refresh timeline" disabled={loading || refreshing} onClick={() => void loadEvents(true)}>
          <RefreshCw size={18} aria-hidden />
        </Button>
      </header>

      <section aria-label="Latest recorded event" style={{ border: "1px solid var(--solenos-hairline)", borderRadius: 16, background: "var(--theme-panel-bg)", padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <History size={19} aria-hidden />
          <h2 style={{ fontSize: 18, margin: 0 }}>Latest recorded event</h2>
        </div>
        {loading ? (
          <p aria-live="polite" style={{ margin: 0, color: "var(--solenos-muted)" }}>Loading saved care events…</p>
        ) : error ? (
          <p style={{ margin: 0, color: "var(--solenos-muted)" }}>The latest event is unavailable until the timeline loads successfully.</p>
        ) : latestEvent ? (
          <>
            <h3 style={{ margin: "0 0 6px", fontSize: 18 }}>{latestEvent.title}</h3>
            <p style={{ margin: "0 0 8px", color: "var(--solenos-muted)" }}>{formatDateTime(latestEvent.occurred_at)} · {eventCategory(latestEvent)}</p>
            <p style={{ margin: 0, lineHeight: 1.55 }}>{parseDescription(latestEvent.description) || "No event description was saved."}</p>
          </>
        ) : (
          <p style={{ margin: 0, lineHeight: 1.55 }}>No saved care events were returned for this record. Add a real care note or observation to begin the history.</p>
        )}
        <p style={{ margin: "12px 0 0", color: "var(--solenos-muted)", fontSize: 12 }}>This is the latest saved event, not a substitute for the reconciled current-care view in the LCR.</p>
      </section>

      <section aria-label="Timeline controls" style={{ marginBottom: 20 }}>
        <label htmlFor="timeline-search" style={{ display: "block", fontWeight: 650, marginBottom: 8 }}>Search the care history</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--solenos-hairline)", background: "var(--theme-panel-bg)", borderRadius: 12, padding: "0 12px", minHeight: 48 }}>
          <Search size={18} aria-hidden />
          <input id="timeline-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events, notes, tags, evidence IDs…" style={{ border: 0, outline: 0, flex: 1, minWidth: 0, padding: "12px 0", background: "transparent", color: "inherit", font: "inherit" }} />
        </div>
        <div role="group" aria-label="Filter timeline events" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {FILTERS.map((item) => {
            const active = filter === item.id;
            return (
              <button key={item.id} type="button" aria-pressed={active} onClick={() => setFilter(item.id)} style={{ border: "1px solid var(--solenos-hairline)", borderRadius: 999, padding: "9px 13px", minHeight: 40, background: active ? "var(--theme-selected-bg)" : "var(--theme-panel-bg)", color: "var(--theme-panel-fg)", font: "inherit", fontWeight: active ? 700 : 500, cursor: "pointer" }}>
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <section role="alert" style={{ border: "1px solid var(--theme-warning-border)", borderRadius: 12, padding: 16, marginBottom: 20, background: "var(--theme-warning-bg)", color: "var(--theme-warning-fg)" }}>
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
            <Button variant="primary" onClick={() => router.push("/workspace?compose=1")}><Plus size={18} aria-hidden /> Add a care record</Button>
            {(query || filter !== "all") && <Button variant="secondary" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</Button>}
          </div>
        </section>
      ) : (
        <section aria-label="Chronological care events">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <h2 style={{ fontSize: 19, margin: 0 }}>History</h2>
            <span style={{ color: "var(--solenos-muted)", fontSize: 13 }}>{visibleEvents.length} {visibleEvents.length === 1 ? "event" : "events"}</span>
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
                    <article key={event.id} style={{ position: "relative", border: "1px solid var(--solenos-hairline)", borderRadius: 14, background: "var(--theme-panel-bg)", overflow: "hidden" }}>
                      <span aria-hidden="true" style={{ position: "absolute", width: 10, height: 10, borderRadius: "50%", background: "#64866b", left: -24, top: 22, boxShadow: "0 0 0 4px var(--paper)" }} />
                      <button type="button" aria-expanded={expanded} aria-controls={`timeline-details-${event.id}`} onClick={() => setExpandedId(expanded ? null : event.id)} style={{ width: "100%", textAlign: "left", border: 0, background: "transparent", padding: 16, display: "block", color: "inherit", cursor: "pointer", font: "inherit" }}>
                        <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, background: "#e4ede5", borderRadius: 999, padding: "5px 9px" }}><Clock3 size={13} aria-hidden />{category}</span>
                          <span style={{ color: "var(--solenos-muted)", fontSize: 12 }}>{formatDateTime(event.occurred_at)}</span>
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
                            <dt style={{ color: "var(--solenos-muted)" }}>Time provenance</dt><dd style={{ margin: 0 }}>{event.time_provenance || "Not recorded"}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Contributor</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{event.source_label || (event.created_by_caregiver_id ? "Caregiver" : "Not recorded")}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Source type</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{event.source_type || event.event_type}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Situation link</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{event.situation_id || "No linked situation ID"}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Evidence references</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{event.evidence_ids?.length ? event.evidence_ids.join(", ") : "No evidence references attached to this event"}</dd>
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

      {historyCoverage.hasMore && (
        <p role="status" style={{ margin: "12px 0", color: "var(--solenos-muted)", fontSize: 12 }}>
          Showing the latest 200 of {historyCoverage.total} matching care-history records. Search or filter narrows this loaded set; older records are not included in this view yet.
        </p>
      )}

      <footer style={{ marginTop: 28, paddingTop: 14, borderTop: "1px solid var(--solenos-hairline)", color: "var(--solenos-muted)", fontSize: 12, display: "flex", alignItems: "flex-start", gap: 8 }}>
        <ShieldCheck size={16} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
        <span>History is ordered by event time, with recording time retained separately. This view does not turn AI interpretation into a care fact or claim that an event caused another event.{loadedAt ? ` Last loaded ${formatDateTime(loadedAt)}.` : ""}</span>
      </footer>
    </main>
  );
}
