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
  occurred_at: string;
  occurred_at_timezone?: string | null;
  recorded_at: string;
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
};

type CareEvidence = {
  id: string;
  type?: string;
  source_text?: string | null;
  source_type?: string | null;
  evidence_status?: string | null;
  epistemic_status?: string | null;
  uploaded_at?: string | null;
  occurred_at?: string | null;
  reported_by_label?: string | null;
  original_author?: string | null;
  extra_metadata?: Record<string, unknown> | null;
};

type FilterKey = "all" | "observations" | "decisions" | "documents" | "open";

const FILTERS: { id: FilterKey; label: string }[] = [
  { id: "all", label: "All events" },
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
  const [evidenceById, setEvidenceById] = useState<Record<string, CareEvidence>>({});
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const loadEvents = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const session = await ensureAnonymousSession();
      if (!session.person?.id || !session.access_token) {
        throw new Error("A valid SolenOS care session is required to load this record.");
      }
      const result = await getJSON(`/events/${encodeURIComponent(session.person.id)}`);
      if (!Array.isArray(result)) {
        throw new Error("The care timeline response was not in the expected format. No events have been assumed.");
      }
      const validEvents = result.filter((item): item is CareEvent =>
        Boolean(item && typeof item.id === "string" && typeof item.title === "string" &&
          typeof item.event_type === "string" && typeof item.person_id === "string")
      );
      setEvents(validEvents.sort((a, b) => {
        const aTime = safeDate(a.occurred_at)?.getTime() ?? Number.NEGATIVE_INFINITY;
        const bTime = safeDate(b.occurred_at)?.getTime() ?? Number.NEGATIVE_INFINITY;
        if (aTime !== bTime) return bTime - aTime;
        return (safeDate(b.recorded_at)?.getTime() ?? 0) - (safeDate(a.recorded_at)?.getTime() ?? 0);
      }));

      // Hydrate only evidence explicitly referenced by these care events.
      const evidenceIds = [...new Set(validEvents.flatMap((event) => event.evidence_ids ?? []).filter(Boolean))];
      if (evidenceIds.length) {
        try {
          const params = new URLSearchParams();
          evidenceIds.forEach((id) => params.append("ids", id));
          const evidenceResult = await getJSON(
            `/evidence/${encodeURIComponent(session.person.id)}?${params.toString()}`
          );
          if (!Array.isArray(evidenceResult)) throw new Error("The evidence response was not a list.");
          const nextEvidence: Record<string, CareEvidence> = {};
          evidenceResult.forEach((item) => {
            if (item && typeof item.id === "string") nextEvidence[item.id] = item as CareEvidence;
          });
          setEvidenceById(nextEvidence);
          setEvidenceError(null);
        } catch {
          setEvidenceById({});
          setEvidenceError("Linked evidence details are temporarily unavailable. The event references remain visible; this does not mean the source files or notes are missing.");
        }
      } else {
        setEvidenceById({});
        setEvidenceError(null);
      }
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
          <h1 style={{ marginBottom: 8 }}>Care Timeline</h1>
          <p style={{ marginTop: 0, maxWidth: 620 }}>A chronological, source-linked history of recorded care events. Historical reports remain distinct from the current care understanding.</p>
        </div>
        <Button variant="icon" aria-label="Refresh timeline" disabled={loading || refreshing} onClick={() => void loadEvents(true)}>
          <RefreshCw size={18} aria-hidden />
        </Button>
      </header>

      <section aria-label="Latest recorded event" style={{ border: "1px solid var(--solenos-hairline)", borderRadius: 16, background: "white", padding: 20, marginBottom: 20 }}>
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--solenos-hairline)", background: "white", borderRadius: 12, padding: "0 12px", minHeight: 48 }}>
          <Search size={18} aria-hidden />
          <input id="timeline-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events, notes, tags, evidence IDs…" style={{ border: 0, outline: 0, flex: 1, minWidth: 0, padding: "12px 0", background: "transparent", color: "inherit", font: "inherit" }} />
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
                    <article key={event.id} style={{ position: "relative", border: "1px solid var(--solenos-hairline)", borderRadius: 14, background: "white", overflow: "hidden" }}>
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
                            <dt style={{ color: "var(--solenos-muted)" }}>Source caregiver ID</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{event.created_by_caregiver_id || "Not recorded"}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Situation link</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{event.situation_id || "No linked situation ID"}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Evidence references</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{event.evidence_ids?.length ? event.evidence_ids.join(", ") : "No evidence references attached to this event"}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Tags</dt><dd style={{ margin: 0 }}>{event.tags?.length ? event.tags.join(", ") : "No tags recorded"}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Updated</dt><dd style={{ margin: 0 }}>{formatDateTime(event.updated_at)}</dd>
                          </dl>
                          {event.evidence_ids?.length ? (
                            <section aria-label="Linked source evidence" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--solenos-hairline)" }}>
                              <h5 style={{ margin: "0 0 8px", fontSize: 13 }}>Linked source evidence</h5>
                              {evidenceError && <p role="status" style={{ margin: "0 0 8px", color: "var(--solenos-muted)", fontSize: 12 }}>{evidenceError}</p>}
                              <div style={{ display: "grid", gap: 8 }}>
                                {event.evidence_ids.map((evidenceId) => {
                                  const source = evidenceById[evidenceId];
                                  return (
                                    <article key={evidenceId} style={{ padding: 10, border: "1px solid var(--solenos-hairline)", borderRadius: 10, background: "white" }}>
                                      <strong style={{ display: "block", fontSize: 12 }}>Evidence {evidenceId}</strong>
                                      {source ? (
                                        <>
                                          <p style={{ margin: "5px 0", fontSize: 12, color: "var(--solenos-muted)" }}>
                                            {[source.type, source.source_type, source.evidence_status || source.epistemic_status].filter(Boolean).join(" · ") || "Source type/status not recorded"}
                                          </p>
                                          <p style={{ margin: "5px 0", fontSize: 12 }}>
                                            Reported by: {source.reported_by_label || source.original_author || "Not recorded"}
                                          </p>
                                          <p style={{ margin: "5px 0", fontSize: 12, color: "var(--solenos-muted)" }}>
                                            Event time: {formatDateTime(source.occurred_at)} · Uploaded: {formatDateTime(source.uploaded_at)}
                                          </p>
                                          {source.source_text && <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{source.source_text.slice(0, 3000)}{source.source_text.length > 3000 ? "… Source text is truncated in this view." : ""}</p>}
                                        </>
                                      ) : !evidenceError ? (
                                        <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--solenos-muted)" }}>This referenced evidence was not returned by the person-scoped evidence lookup.</p>
                                      ) : null}
                                    </article>
                                  );
                                })}
                              </div>
                            </section>
                          ) : null}
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
        <span>History is ordered by event time, with recording time retained separately. This view does not turn AI interpretation into a care fact or claim that an event caused another event.{loadedAt ? ` Last loaded ${formatDateTime(loadedAt)}.` : ""}</span>
      </footer>
    </main>
  );
}
