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
import { caregiverInformationLabel, caregiverSafeAssistantText, caregiverStatusLabel } from "@/lib/caregiver-language";
import { ensureAnonymousSession, getCaregiverId, getJSON, postJSON } from "@/api/client";

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
  target_type?: string | null;
  target_id?: string | null;
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
  { id: "all", label: "All updates" },
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
  const title = caregiverSafeAssistantText(typeof row.title === "string" ? row.title : null)
    || (sourceType === "correction" ? "Care record correction"
      : sourceType === "evidence" ? "Document added"
        : sourceType === "appointment" ? "Appointment"
          : "Care update");

  return {
    id: idValue,
    person_id: typeof row.person_id === "string" ? row.person_id : personId,
    event_type: eventType,
    status: typeof row.status === "string" ? row.status
      : typeof row.assertion_status === "string" ? row.assertion_status
        : typeof row.epistemic_status === "string" ? row.epistemic_status : "Not specified",
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
    target_type: typeof row.target_type === "string" ? row.target_type : null,
    target_id: typeof row.target_id === "string" ? row.target_id : null,
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
  const value = `${event.event_type} ${event.source_type ?? ""} ${event.title} ${(event.tags ?? []).join(" ")}`.toLowerCase();
  if (/decision|decided|choice/.test(value)) return "Decision";
  if (/document|upload|file|discharge|letter|report/.test(value)) return "Document";
  if (/follow.?up|open.?loop|pending|unresolved|question|appointment|conflict|uncertaint|missing.?information|information.?gap|reconciliation/.test(value) || event.follow_up_candidate || event.attention_candidate) return "Follow-up";
  if (/observation|daily.?care|daily.?capture|symptom|behavio[u]?r/.test(value)) return "Observation";
  if (/correction|amend|supersed/.test(value)) return "Correction";
  if (/handoff|hand.?over|transfer/.test(value)) return "Handoff";
  if (/outcome|result|completed/.test(value)) return "Outcome";
  return caregiverStatusLabel(event.event_type) || "Care update";
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
    if (typeof parsed === "string") return caregiverSafeAssistantText(parsed) || "Saved care information";
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const root = parsed as Record<string, unknown>;
      const capture = (root.original_capture && typeof root.original_capture === "object" && !Array.isArray(root.original_capture)
        ? root.original_capture
        : root) as Record<string, unknown>;
      const readable: string[] = [];
      const quick = capture.quick_check_in && typeof capture.quick_check_in === "object"
        ? capture.quick_check_in as Record<string, unknown>
        : null;
      if (quick && typeof quick.kind === "string") {
        const labels: Record<string, string> = {
          same_as_usual: "About the same as usual",
          change: "Some things were different",
          uncertain: "It was hard to tell",
        };
        readable.push(labels[quick.kind] || "Quick check-in recorded");
      }
      const note = typeof quick?.note === "string" && quick.note.trim()
        ? caregiverSafeAssistantText(quick.note.trim()) || ""
        : typeof capture.notes === "string" && capture.notes.trim()
          ? caregiverSafeAssistantText(capture.notes.trim()) || ""
          : typeof capture.original_notes === "string" && capture.original_notes.trim()
            ? caregiverSafeAssistantText(capture.original_notes.trim()) || ""
            : "";
      if (note) readable.push(note);

      if (Array.isArray(capture.medications)) {
        for (const item of capture.medications) {
          if (!item || typeof item !== "object") continue;
          const medicine = item as Record<string, unknown>;
          const name = typeof medicine.medication_name === "string" ? medicine.medication_name : "Medicine";
          const status = typeof medicine.status === "string" ? medicine.status : "not_recorded";
          const labels: Record<string, string> = {
            given: "reported given",
            not_given: "reported not given",
            uncertain: "not sure whether it was given",
            scheduled: "scheduled; not confirmed as given",
            other: "other medicine update",
          };
          const time = typeof medicine.administered_at === "string"
            ? ` at ${formatDateTime(medicine.administered_at)}`
            : typeof medicine.scheduled_for === "string"
              ? ` (scheduled for ${formatDateTime(medicine.scheduled_for)}; not proof it was given)`
              : "";
          readable.push(`${caregiverSafeAssistantText(name) || "Medicine"}: ${labels[status] || caregiverStatusLabel(status) || "Status not recorded"}${time}`);
        }
      }
      if (Array.isArray(capture.vitals)) {
        for (const item of capture.vitals) {
          if (!item || typeof item !== "object") continue;
          const reading = item as Record<string, unknown>;
          const label = typeof reading.measurement_name === "string" && reading.measurement_name.trim()
            ? reading.measurement_name
            : typeof reading.vital_type === "string" ? ({ blood_pressure: "Blood pressure", heart_rate: "Heart rate", temperature: "Temperature", oxygen_saturation: "Oxygen level", weight: "Weight", blood_glucose: "Blood sugar", respiratory_rate: "Breathing rate" } as Record<string, string>)[reading.vital_type] || "Measurement" : "Measurement";
          if (typeof reading.value === "number" || typeof reading.value === "string") {
            readable.push(`${caregiverSafeAssistantText(label) || "Measurement"}: ${reading.value}${typeof reading.unit === "string" && reading.unit ? ` ${reading.unit}` : ""}`);
          }
        }
      }
      if (readable.length) return readable.join("\n");
      return "Saved care information";
    }
  } catch {
    // Preserve plain-text descriptions as entered.
  }
  return caregiverSafeAssistantText(description) || "Saved care information";
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
  const [historyOffset, setHistoryOffset] = useState(0);
  const [appliedQuery, setAppliedQuery] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [correctionTargetId, setCorrectionTargetId] = useState<string | null>(null);
  const [correctionText, setCorrectionText] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionSaving, setCorrectionSaving] = useState(false);
  const [correctionMessage, setCorrectionMessage] = useState("");

  const loadEvents = useCallback(async (manual = false, searchTerm = "") => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const session = await ensureAnonymousSession();
      if (!session.person?.id || !session.access_token) {
        throw new Error("A valid SolenOS care session is required to load this record.");
      }
      const searchParam = searchTerm.trim() ? `&query=${encodeURIComponent(searchTerm.trim())}` : "";
      const result = await getJSON(`/daily-care/intelligence/history?limit=200&offset=0${searchParam}`) as {
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
      setHistoryOffset(result.records.length);
      setLoadedAt(new Date().toISOString());
    } catch (cause) {
      setError("The care timeline could not be loaded. Check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMoreEvents = useCallback(async () => {
    if (!historyCoverage.hasMore || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const session = await ensureAnonymousSession();
      if (!session.person?.id || !session.access_token) {
        throw new Error("A valid SolenOS care session is required to load older history.");
      }
      const offset = historyOffset;
      const searchParam = appliedQuery.trim() ? `&query=${encodeURIComponent(appliedQuery.trim())}` : "";
      const result = await getJSON(`/daily-care/intelligence/history?limit=200&offset=${offset}${searchParam}`) as {
        records?: unknown;
        page?: { has_more?: boolean; total_matching?: number };
      };
      if (!Array.isArray(result?.records)) {
        throw new Error("Older care history could not be read. The entries already loaded remain available.");
      }
      const olderEvents = result.records
        .map((item) => mapHistoryRecord(item, session.person!.id))
        .filter((item): item is CareEvent => item !== null);
      setEvents((current) => {
        const unique = new Map(current.map((item) => [item.id, item]));
        for (const item of olderEvents) unique.set(item.id, item);
        return [...unique.values()].sort((a, b) => {
          const aTime = safeDate(a.occurred_at)?.getTime() ?? safeDate(a.recorded_at)?.getTime() ?? Number.NEGATIVE_INFINITY;
          const bTime = safeDate(b.occurred_at)?.getTime() ?? safeDate(b.recorded_at)?.getTime() ?? Number.NEGATIVE_INFINITY;
          if (aTime !== bTime) return bTime - aTime;
          return (safeDate(b.recorded_at)?.getTime() ?? 0) - (safeDate(a.recorded_at)?.getTime() ?? 0);
        });
      });
      setHistoryOffset(offset + result.records.length);
      setHistoryCoverage({
        hasMore: Boolean(result.page?.has_more),
        total: typeof result.page?.total_matching === "number" ? result.page.total_matching : historyCoverage.total,
      });
    } catch (cause) {
      setError("Older care history could not be loaded. The entries already shown remain available.");
    } finally {
      setLoadingMore(false);
    }
  }, [historyCoverage, historyOffset, loadingMore, appliedQuery]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const submitCorrection = useCallback(async (event: CareEvent) => {
    if (!correctionText.trim() || correctionSaving) return;
    setCorrectionSaving(true);
    setCorrectionMessage("");
    try {
      const session = await ensureAnonymousSession();
      const caregiverId = getCaregiverId();
      if (!session.person?.id || !session.access_token || !caregiverId) {
        throw new Error("A verified care session is required to save a correction.");
      }
      const result = await postJSON("/corrections", {
        person_id: session.person.id,
        caregiver_id: caregiverId,
        target_type: event.source_type === "care_assertion" ? "care_assertion" : "care_event",
        target_id: event.id,
        original_text: parseDescription(event.description) || event.title,
        corrected_text: correctionText.trim(),
        reason: correctionReason.trim() || undefined,
      }) as { id?: string; care_continuity_execution?: { stages?: Record<string, string> } };
      if (!result?.id) {
        throw new Error("The server did not confirm that the correction was saved.");
      }
      const reconciliation = result.care_continuity_execution?.stages?.reconciliation;
      setCorrectionMessage(reconciliation === "committed"
        ? "Correction saved. The original entry remains unchanged, and the care record was reassessed."
        : "Correction saved as a separate record. The original entry remains unchanged; care-record reassessment is still pending.");
      setCorrectionTargetId(null);
      setCorrectionText("");
      setCorrectionReason("");
      await loadEvents(true, appliedQuery);
    } catch (cause) {
      setCorrectionMessage("The correction could not be saved. The original entry is unchanged. Please try again.");
    } finally {
      setCorrectionSaving(false);
    }
  }, [correctionText, correctionReason, correctionSaving, loadEvents, appliedQuery]);

  const visibleEvents = useMemo(() => {
    const needle = appliedQuery.trim().toLowerCase();
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
  }, [events, filter, appliedQuery]);

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
          <p style={{ marginTop: 0, maxWidth: 620 }}>A history of saved care updates. Older reports remain separate from the latest care summary.</p>
        </div>
        <Button variant="icon" aria-label="Refresh timeline" disabled={loading || refreshing} onClick={() => void loadEvents(true, appliedQuery)}>
          <RefreshCw size={18} aria-hidden />
        </Button>
      </header>

      <section aria-label="Latest recorded update" style={{ border: "1px solid var(--solenos-hairline)", borderRadius: 16, background: "var(--theme-panel-bg)", padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <History size={19} aria-hidden />
          <h2 style={{ fontSize: 18, margin: 0 }}>Latest recorded update</h2>
        </div>
        {loading ? (
          <p aria-live="polite" style={{ margin: 0, color: "var(--solenos-muted)" }}>Loading saved care updates…</p>
        ) : error ? (
          <p style={{ margin: 0, color: "var(--solenos-muted)" }}>The latest update is unavailable until the timeline loads.</p>
        ) : latestEvent ? (
          <>
            <h3 style={{ margin: "0 0 6px", fontSize: 18 }}>{caregiverSafeAssistantText(latestEvent.title) || "Care update"}</h3>
            <p style={{ margin: "0 0 8px", color: "var(--solenos-muted)" }}>{formatDateTime(latestEvent.occurred_at)} · {eventCategory(latestEvent)}</p>
            <p style={{ margin: 0, lineHeight: 1.55 }}>{parseDescription(latestEvent.description) || "No event description was saved."}</p>
          </>
        ) : (
          <p style={{ margin: 0, lineHeight: 1.55 }}>No saved care updates are available for this record yet. Add a care note or observation to begin the history.</p>
        )}
        <p style={{ margin: "12px 0 0", color: "var(--solenos-muted)", fontSize: 12 }}>This is the latest saved update. For the current care summary, return to your Living Care Record.</p>
      </section>

      <section aria-label="Timeline controls" style={{ marginBottom: 20 }}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const nextQuery = query.trim();
            setAppliedQuery(nextQuery);
            void loadEvents(true, nextQuery);
          }}
        >
          <label htmlFor="timeline-search" style={{ display: "block", fontWeight: 650, marginBottom: 8 }}>Search the care history</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--solenos-hairline)", background: "var(--theme-panel-bg)", borderRadius: 12, padding: "0 12px", minHeight: 48 }}>
            <Search size={18} aria-hidden />
            <input id="timeline-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all saved care records…" style={{ border: 0, outline: 0, flex: 1, minWidth: 0, padding: "12px 0", background: "transparent", color: "inherit", font: "inherit" }} />
            <Button type="submit" variant="secondary" disabled={loading || refreshing}>Search</Button>
          </div>
          {appliedQuery && (
            <p style={{ margin: "6px 0 0", color: "var(--solenos-muted)", fontSize: 12 }}>
              Showing results for “{appliedQuery}”. Search includes older records, not just the items currently shown.
              <button type="button" onClick={() => { setQuery(""); setAppliedQuery(""); void loadEvents(true, ""); }} style={{ marginLeft: 8, border: 0, background: "transparent", color: "inherit", textDecoration: "underline", cursor: "pointer" }}>Clear search</button>
            </p>
          )}
        </form>
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
              <Button variant="primary" onClick={() => void loadEvents(true, appliedQuery)} disabled={refreshing}>Try again</Button>
            </div>
          </div>
        </section>
      )}

      {loading ? (
        <p aria-live="polite">Loading care history…</p>
      ) : !error && visibleEvents.length === 0 ? (
        <section className="mobile-empty" style={{ padding: 28 }}>
          <div className="mobile-empty-icon" aria-hidden="true"><Activity size={36} /></div>
          <h2 className="mobile-empty-title">{events.length ? "No matching events" : "Your timeline starts with real records"}</h2>
          <p className="mobile-empty-body">{events.length ? "Try another filter or search term. No records were removed." : "SolenOS will show care updates here after they have been saved. This screen never adds example care history."}</p>
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
                    <article id={`timeline-event-${event.id}`} key={event.id} style={{ position: "relative", border: "1px solid var(--solenos-hairline)", borderRadius: 14, background: "var(--theme-panel-bg)", overflow: "hidden" }}>
                      <span aria-hidden="true" style={{ position: "absolute", width: 10, height: 10, borderRadius: "50%", background: "#64866b", left: -24, top: 22, boxShadow: "0 0 0 4px var(--paper)" }} />
                      <button type="button" aria-expanded={expanded} aria-controls={`timeline-details-${event.id}`} onClick={() => setExpandedId(expanded ? null : event.id)} style={{ width: "100%", textAlign: "left", border: 0, background: "transparent", padding: 16, display: "block", color: "inherit", cursor: "pointer", font: "inherit" }}>
                        <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, background: "#e4ede5", borderRadius: 999, padding: "5px 9px" }}><Clock3 size={13} aria-hidden />{category}</span>
                          <span style={{ color: "var(--solenos-muted)", fontSize: 12 }}>{formatDateTime(event.occurred_at)}</span>
                          {event.follow_up_candidate && <span style={{ fontSize: 12, fontWeight: 650 }}>Follow-up flagged</span>}
                          {event.attention_candidate && <span style={{ fontSize: 12, fontWeight: 650 }}>Attention flagged</span>}
                          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--solenos-muted)" }}>{expanded ? "Hide details" : "Details"} <ChevronDown size={16} aria-hidden style={{ transform: expanded ? "rotate(180deg)" : undefined }} /></span>
                        </span>
                        <strong style={{ display: "block", fontSize: 17, lineHeight: 1.4, marginBottom: 5 }}>{caregiverSafeAssistantText(event.title) || "Care update"}</strong>
                        {description && <span style={{ display: "-webkit-box", WebkitLineClamp: expanded ? "unset" : 2, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-wrap", lineHeight: 1.5, overflowWrap: "anywhere" }}>{description}</span>}
                      </button>
                      {expanded && (
                        <div id={`timeline-details-${event.id}`} style={{ borderTop: "1px solid var(--solenos-hairline)", padding: 16, background: "#fbfcfc" }}>
                          <h4 style={{ margin: "0 0 10px", fontSize: 14 }}>Record details</h4>
                          <dl style={{ display: "grid", gridTemplateColumns: "minmax(110px, 0.7fr) minmax(0, 1.3fr)", gap: "9px 12px", margin: 0, fontSize: 13 }}>
                            <dt style={{ color: "var(--solenos-muted)" }}>When it happened</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{formatDateTime(event.occurred_at)}{event.occurred_at_timezone ? ` (${event.occurred_at_timezone})` : ""}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>When it was saved</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{formatDateTime(event.recorded_at)}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Review</dt><dd style={{ margin: 0 }}>{caregiverStatusLabel(event.status) || caregiverInformationLabel(event.status) || "Not recorded"}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Time details</dt><dd style={{ margin: 0 }}>{caregiverStatusLabel(event.time_provenance) || "Not recorded"}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Contributor</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{caregiverSafeAssistantText(event.source_label) || (event.created_by_caregiver_id ? "Caregiver" : "Not recorded")}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Type of update</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{event.source_type === "correction" ? "Correction" : event.source_type === "evidence" ? "Document" : event.source_type === "appointment" ? "Appointment" : event.source_type === "professional" ? "Healthcare professional" : event.created_by_caregiver_id ? "Caregiver" : "Care update"}</dd>
                            {event.source_type === "correction" && event.target_id && (
                              <>
                                <dt style={{ color: "var(--solenos-muted)" }}>Related update</dt>
                                <dd style={{ margin: 0, overflowWrap: "anywhere" }}>
                                  {event.target_type === "care_event" || event.target_type === "care_assertion" ? (
                                    <a href={`#timeline-event-${event.target_id}`}>Original care event</a>
                                  ) : (
                                    "Original saved detail"
                                  )}
                                  
                                </dd>
                              </>
                            )}
                            <dt style={{ color: "var(--solenos-muted)" }}>Related care topic</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{event.situation_id ? "Linked" : "Not linked"}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Supporting information</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{event.evidence_ids?.length ? `${event.evidence_ids.length} saved item(s)` : "None attached"}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Related labels</dt><dd style={{ margin: 0 }}>{event.tags?.length ? event.tags.map(tag => caregiverStatusLabel(tag) || "Care update").join(", ") : "None recorded"}</dd>
                            <dt style={{ color: "var(--solenos-muted)" }}>Updated</dt><dd style={{ margin: 0 }}>{formatDateTime(event.updated_at)}</dd>
                          </dl>
                          {event.significance_verdict && <p style={{ margin: "12px 0 0" }}><strong>Why this may matter:</strong> {caregiverSafeAssistantText(event.significance_verdict) || "No further explanation is available."}</p>}
                          {(event.source_type === "care_event" || (
                            event.source_type === "care_assertion" &&
                            !["superseded", "retracted"].includes(event.status.toLowerCase())
                          )) && (
                            <div style={{ marginTop: 16, borderTop: "1px solid var(--solenos-hairline)", paddingTop: 14 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setCorrectionTargetId(correctionTargetId === event.id ? null : event.id);
                                  setCorrectionText("");
                                  setCorrectionReason("");
                                  setCorrectionMessage("");
                                }}
                                style={{ border: "1px solid var(--solenos-hairline)", borderRadius: 8, padding: "9px 12px", background: "var(--theme-panel-bg)", color: "inherit", font: "inherit", cursor: "pointer" }}
                              >
                                {correctionTargetId === event.id ? "Close correction" : "Suggest a correction"}
                              </button>
                              {correctionTargetId === event.id && (
                                <form onSubmit={(submitEvent) => { submitEvent.preventDefault(); void submitCorrection(event); }} style={{ marginTop: 12, display: "grid", gap: 10 }}>
                                  <p style={{ margin: 0, color: "var(--solenos-muted)", fontSize: 13 }}>
                                    This adds a separate correction record. It does not erase or silently rewrite the original entry.
                                  </p>
                                  <label style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 650 }}>
                                    What should be corrected?
                                    <textarea
                                      value={correctionText}
                                      onChange={(inputEvent) => setCorrectionText(inputEvent.target.value)}
                                      rows={4}
                                      maxLength={4000}
                                      required
                                      placeholder="Describe the accurate information."
                                      style={{ width: "100%", border: "1px solid var(--solenos-hairline)", borderRadius: 8, padding: 10, background: "var(--theme-panel-bg)", color: "inherit", font: "inherit", resize: "vertical" }}
                                    />
                                  </label>
                                  <label style={{ display: "grid", gap: 5, fontSize: 13, fontWeight: 650 }}>
                                    Reason (optional)
                                    <input
                                      value={correctionReason}
                                      onChange={(inputEvent) => setCorrectionReason(inputEvent.target.value)}
                                      maxLength={1000}
                                      placeholder="Why is this correction needed?"
                                      style={{ width: "100%", border: "1px solid var(--solenos-hairline)", borderRadius: 8, padding: 10, background: "var(--theme-panel-bg)", color: "inherit", font: "inherit" }}
                                    />
                                  </label>
                                  <button type="submit" disabled={correctionSaving || !correctionText.trim()} style={{ justifySelf: "start", border: 0, borderRadius: 8, padding: "10px 14px", background: "var(--theme-selected-bg)", color: "var(--theme-panel-fg)", font: "inherit", fontWeight: 700, cursor: correctionSaving ? "wait" : "pointer" }}>
                                    {correctionSaving ? "Saving correction…" : "Save correction"}
                                  </button>
                                </form>
                              )}
                            </div>
                          )}
                          <p style={{ margin: "12px 0 0", color: "var(--solenos-muted)", fontSize: 12 }}>This update shows only the details saved at the time. Missing information is not guessed.</p>
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

      {correctionMessage && (
        <p role="status" style={{ margin: "12px 0", color: "var(--solenos-muted)", fontSize: 13 }}>
          {correctionMessage}
        </p>
      )}

      {historyCoverage.hasMore && (
        <div style={{ margin: "16px 0", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Button variant="secondary" disabled={loadingMore} onClick={() => void loadMoreEvents()}>
            {loadingMore ? "Loading older records…" : "Load older care records"}
          </Button>
          <span role="status" style={{ color: "var(--solenos-muted)", fontSize: 12 }}>
            Showing {events.length} of {historyCoverage.total} matching care updates.
          </span>
        </div>
      )}

      <footer style={{ marginTop: 28, paddingTop: 14, borderTop: "1px solid var(--solenos-hairline)", color: "var(--solenos-muted)", fontSize: 12, display: "flex", alignItems: "flex-start", gap: 8 }}>
        <ShieldCheck size={16} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Updates are shown by when they happened, while keeping the date they were saved. A suggested interpretation is not treated as confirmed, and timing alone does not prove cause.{loadedAt ? ` Last loaded ${formatDateTime(loadedAt)}.` : ""}</span>
      </footer>
    </main>
  );
}
