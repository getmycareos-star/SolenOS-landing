"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
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
import CaptureAnalysisReview from "@/components/workflows/CaptureAnalysisReview";
import { caregiverInformationLabel, caregiverSourceText, caregiverSafeAssistantText, caregiverStatusLabel } from "@/lib/caregiver-language";
import { ensureAnonymousSession, getCaregiverId, getJSON, postJSON } from "@/api/client";
const CareChangeHistoryPanel = dynamic(() => import("@/components/mvp-workspace/CareChangeHistoryPanel"), { ssr: false, loading: () => <p role="status">Loading saved care changes…</p> });
const ChangeIntelligencePanel = dynamic(() => import("@/components/mvp-workspace/ChangeIntelligencePanel").then((module) => module.ChangeIntelligencePanel), { ssr: false, loading: () => <p role="status">Loading care changes…</p> });

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
  processing_status?: string | null;
  processing_attempts?: number;
  significance_verdict?: string | null;
  attention_candidate?: boolean | null;
  follow_up_candidate?: boolean | null;
  confidence?: number | null;
  situation_id?: string | null;
  capture_processing?: {
    analysis_id?: string | null;
    review_required?: boolean;
    job_status?: string | null;
    message?: string | null;
  } | null;
};

type FilterKey = "all" | "observations" | "decisions" | "documents" | "open";

const FILTERS: { id: FilterKey; label: string }[] = [
  { id: "all", label: "All updates" },
  { id: "observations", label: "What caregivers noticed" },
  { id: "decisions", label: "Decisions" },
  { id: "documents", label: "Documents" },
  { id: "open", label: "Follow-ups" },
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
    status: sourceType === "correction" && typeof row.processing_status === "string"
      ? row.processing_status
      : typeof row.status === "string" ? row.status
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
    processing_status: typeof row.processing_status === "string" ? row.processing_status : null,
    processing_attempts: typeof row.processing_attempts === "number" ? row.processing_attempts : 0,
    significance_verdict: typeof row.significance_verdict === "string" ? row.significance_verdict : null,
    attention_candidate: row.attention_candidate === true,
    follow_up_candidate: row.follow_up_candidate === true,
    confidence: typeof row.confidence === "number" ? row.confidence : null,
    situation_id: typeof row.situation_id === "string" ? row.situation_id : null,
    capture_processing: row.capture_processing && typeof row.capture_processing === "object" && !Array.isArray(row.capture_processing)
      ? row.capture_processing as CareEvent["capture_processing"]
      : null,
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
    if (typeof parsed === "string") return caregiverSourceText(parsed) || "Saved care information";
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
        ? caregiverSourceText(quick.note.trim()) || ""
        : typeof capture.notes === "string" && capture.notes.trim()
          ? caregiverSourceText(capture.notes.trim()) || ""
          : typeof capture.original_notes === "string" && capture.original_notes.trim()
            ? caregiverSourceText(capture.original_notes.trim()) || ""
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
          readable.push(`${caregiverSourceText(name) || "Medicine"}: ${labels[status] || caregiverStatusLabel(status) || "Status not recorded"}${time}`);
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
            readable.push(`${caregiverSourceText(label) || "Measurement"}: ${reading.value}${typeof reading.unit === "string" && reading.unit ? ` ${reading.unit}` : ""}`);
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
  const [personId, setPersonId] = useState<string | null>(null);
  const [changeHistoryOpen, setChangeHistoryOpen] = useState(false);
  const changeHistoryDetailsRef = useRef<HTMLDetailsElement | null>(null);
  useEffect(() => {
    // Preserve a native disclosure opened before React finishes hydrating.
    if (changeHistoryDetailsRef.current?.open) setChangeHistoryOpen(true);
  }, []);
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
  const [correctionIdempotencyKey, setCorrectionIdempotencyKey] = useState<string | null>(null);
  const [pendingCorrectionId, setPendingCorrectionId] = useState<string | null>(null);
  const [reviewAnalysisId, setReviewAnalysisId] = useState<string | null>(null);
  const [retryingCorrection, setRetryingCorrection] = useState(false);

  const loadEvents = useCallback(async (manual = false, searchTerm = "") => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const session = await ensureAnonymousSession();
      if (!session.person?.id || !session.access_token) {
        throw new Error("A valid SolenOS care session is required to load this record.");
      }
      setPersonId(session.person.id);
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

  // Recover a pending correction after a browser reload and keep its visible
  // status aligned with the durable backend receipt.
  useEffect(() => {
    if (pendingCorrectionId) return;
    const pending = events.find(
      (item) => item.source_type === "correction" && ["pending", "processing"].includes(item.processing_status || ""),
    );
    if (pending?.id) setPendingCorrectionId(pending.id);
  }, [events, pendingCorrectionId]);

  useEffect(() => {
    if (!pendingCorrectionId) return;
    let cancelled = false;

    const refreshCorrectionStatus = async () => {
      try {
        const session = await ensureAnonymousSession();
        if (!session.person?.id || !session.access_token) return;
        const rows = await getJSON(`/corrections/${encodeURIComponent(session.person.id)}`) as Array<{
          id?: string;
          processing_status?: string;
        }>;
        if (cancelled || !Array.isArray(rows)) return;
        const receipt = rows.find((row) => row.id === pendingCorrectionId);
        if (receipt?.processing_status === "completed") {
          await loadEvents(true, appliedQuery);
          if (cancelled) return;
          setPendingCorrectionId(null);
          setCorrectionMessage("The Care Record has been updated. The original entry remains available in your history.");
        }
      } catch {
        // Keep the saved correction visible as pending; a temporary read failure
        // must never be presented as a successful update.
      }
    };

    void refreshCorrectionStatus();
    const interval = window.setInterval(() => void refreshCorrectionStatus(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pendingCorrectionId, loadEvents, appliedQuery]);

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
      const idempotencyKey = correctionIdempotencyKey || globalThis.crypto.randomUUID();
      if (!correctionIdempotencyKey) setCorrectionIdempotencyKey(idempotencyKey);
      const result = await postJSON("/corrections", {
        person_id: session.person.id,
        caregiver_id: caregiverId,
        target_type: event.source_type === "care_assertion" ? "care_assertion" : "care_event",
        target_id: event.id,
        original_text: parseDescription(event.description) || event.title,
        corrected_text: correctionText.trim(),
        reason: correctionReason.trim() || undefined,
        idempotency_key: idempotencyKey,
      }) as {
        id?: string;
        processing_status?: string;
        care_continuity_execution?: { stages?: Record<string, string> };
      };
      if (!result?.id) {
        throw new Error("The server did not confirm that the correction was saved.");
      }
      const completed = result.processing_status === "completed";
      setPendingCorrectionId(completed ? null : result.id);
      setCorrectionMessage(completed
        ? "Correction saved. The original entry remains unchanged, and the Care Record was updated."
        : "Correction saved. The original entry remains unchanged. The Care Record update is still being checked.");
      setCorrectionTargetId(null);
      setCorrectionText("");
      setCorrectionReason("");
      setCorrectionIdempotencyKey(null);
      await loadEvents(true, appliedQuery);
    } catch {
      // Keep the same key while the caregiver retries the unchanged correction.
      setCorrectionMessage("We could not confirm the correction yet. Try saving again; SolenOS will check the same correction rather than create another one.");
    } finally {
      setCorrectionSaving(false);
    }
  }, [correctionText, correctionReason, correctionSaving, correctionIdempotencyKey, loadEvents, appliedQuery]);

  const retryPendingCorrection = useCallback(async () => {
    const correctionId = pendingCorrectionId || events.find(
      (item) => item.source_type === "correction" && ["pending", "processing"].includes(item.processing_status || ""),
    )?.id;
    if (!correctionId || retryingCorrection) return;
    setRetryingCorrection(true);
    try {
      const session = await ensureAnonymousSession();
      if (!session.person?.id || !session.access_token) {
        throw new Error("A verified care session is required.");
      }
      const result = await postJSON(
        `/corrections/${encodeURIComponent(session.person.id)}/${encodeURIComponent(correctionId)}/retry`,
        {},
      ) as { processing_status?: string };
      if (result.processing_status === "completed") {
        setPendingCorrectionId(null);
        setCorrectionMessage("The Care Record has now been updated. The original entry remains available in your history.");
      } else {
        setCorrectionMessage("The correction is saved, but the Care Record update is still pending. You can try again.");
      }
      await loadEvents(true, appliedQuery);
    } catch {
      setCorrectionMessage("The correction remains saved. We could not complete the Care Record update yet.");
    } finally {
      setRetryingCorrection(false);
    }
  }, [pendingCorrectionId, events, retryingCorrection, loadEvents, appliedQuery]);

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
    <div className="mobile-screen timeline-workspace">
      <header className="mobile-page-head timeline-page-head">
        <div>
          <p className="timeline-eyebrow">Care Record</p>
          <h1 className="timeline-page-title">Care history</h1>
          <p className="timeline-page-description">A history of saved care updates. Older reports remain separate from the latest care summary.</p>
        </div>
        <Button variant="icon" aria-label="Refresh timeline" disabled={loading || refreshing} onClick={() => void loadEvents(true, appliedQuery)}>
          <RefreshCw size={18} aria-hidden />
        </Button>
      </header>

      <section className="timeline-latest" aria-label="Latest recorded update">
        <div className="timeline-latest-heading">
          <History size={19} aria-hidden />
          <h2 className="timeline-latest-title">Latest care update</h2>
        </div>
        {loading ? (
          <p className="timeline-muted" aria-live="polite">Loading saved care updates…</p>
        ) : error ? (
          <p className="timeline-muted">The latest update is unavailable until the timeline loads.</p>
        ) : latestEvent ? (
          <>
            <h3 className="timeline-latest-event-title">{caregiverSafeAssistantText(latestEvent.title) || "Care update"}</h3>
            <p className="timeline-latest-meta">{formatDateTime(latestEvent.occurred_at)} · {eventCategory(latestEvent)}</p>
            <p className="timeline-latest-description">{parseDescription(latestEvent.description) || "No event description was saved."}</p>
          </>
        ) : (
          <p className="timeline-latest-description">No saved care updates are available for this record yet. Add a care note or observation to begin the history.</p>
        )}
        <p className="timeline-event-provenance-note">This is the latest saved update. For the current care summary, return to your Care Record.</p>
      </section>

      <section className="timeline-controls" aria-label="Timeline controls">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const nextQuery = query.trim();
            setAppliedQuery(nextQuery);
            void loadEvents(true, nextQuery);
          }}
        >
          <label className="timeline-search-label" htmlFor="timeline-search">Search the care history</label>
          <div className="timeline-search">
            <Search size={18} aria-hidden />
            <input id="timeline-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all saved care records…" className="timeline-search-input" />
            <Button type="submit" variant="secondary" disabled={loading || refreshing}>Search</Button>
          </div>
          {appliedQuery && (
            <p className="timeline-search-note">
              Showing results for “{appliedQuery}”. Search includes older records, not just the items currently shown.
              <button type="button" onClick={() => { setQuery(""); setAppliedQuery(""); void loadEvents(true, ""); }} className="timeline-clear-search">Clear search</button>
            </p>
          )}
        </form>
        <div className="timeline-filters" role="group" aria-label="Filter timeline events">
          {FILTERS.map((item) => {
            const active = filter === item.id;
            return (
              <button key={item.id} type="button" aria-pressed={active} onClick={() => setFilter(item.id)} className={`timeline-filter${active ? " is-active" : ""}`}>
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <section className="timeline-error" role="alert">
          <div className="timeline-error-layout">
            <AlertCircle size={20} aria-hidden />
            <div className="timeline-error-copy">
              <h2 className="timeline-error-title">Timeline could not be loaded</h2>
              <p className="timeline-error-message">{error}</p>
              <Button variant="primary" onClick={() => void loadEvents(true, appliedQuery)} disabled={refreshing}>Try again</Button>
            </div>
          </div>
        </section>
      )}

      {loading ? (
        <p aria-live="polite">Loading care history…</p>
      ) : !error && visibleEvents.length === 0 ? (
        <section className="mobile-empty timeline-empty">
          <div className="mobile-empty-icon" aria-hidden="true"><Activity size={36} /></div>
          <h2 className="mobile-empty-title">{events.length ? "No matching updates" : "Your care history starts here"}</h2>
          <p className="mobile-empty-body">{events.length ? "Try another filter or search term. No records were removed." : "SolenOS will show care updates here after they have been saved. This screen never adds example care history."}</p>
          <div className="mobile-empty-actions timeline-empty-actions">
            <Button variant="primary" onClick={() => router.push("/workspace?compose=1")}><Plus size={18} aria-hidden /> Add a care update</Button>
            {(query || filter !== "all") && <Button variant="secondary" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</Button>}
          </div>
        </section>
      ) : (
        <section aria-label="Care history in date order">
          <div className="timeline-history-heading">
            <h2 className="timeline-history-title">Earlier care updates</h2>
            <span className="timeline-event-count">{visibleEvents.length} {visibleEvents.length === 1 ? "event" : "events"}</span>
          </div>
          {groupedEvents.map((group) => (
            <div key={group.label} className="timeline-day-group">
              <h3 className="timeline-day-label">{group.label}</h3>
              <div className="timeline-event-list">
                {group.events.map((event) => {
                  const expanded = expandedId === event.id;
                  const category = eventCategory(event);
                  const description = parseDescription(event.description);
                  return (
                    <article id={`timeline-event-${event.id}`} key={event.id} className="timeline-event">
                      <span className="timeline-event-dot" aria-hidden="true" />
                      <button type="button" className="timeline-event-toggle" aria-expanded={expanded} aria-controls={`timeline-details-${event.id}`} onClick={() => setExpandedId(expanded ? null : event.id)}>
                        <span className="timeline-event-meta">
                          <span className="timeline-event-category"><Clock3 size={13} aria-hidden />{category}</span>
                          <span className="timeline-event-date">{formatDateTime(event.occurred_at)}</span>
                          {event.follow_up_candidate && <span className="timeline-event-flag">May need follow-up</span>}
                          {event.attention_candidate && <span className="timeline-event-flag">May need attention</span>}
                          {event.capture_processing?.review_required && <span className="timeline-event-flag">Review suggested details</span>}
                          <span className="timeline-event-disclosure">{expanded ? "Hide details" : "Details"} <ChevronDown size={16} aria-hidden className={expanded ? "is-expanded" : ""} /></span>
                        </span>
                        <strong className="timeline-event-title">{caregiverSafeAssistantText(event.title) || "Care update"}</strong>
                        {description && <span className={`timeline-event-description${expanded ? " is-expanded" : ""}`}>{description}</span>}
                      </button>
                      {expanded && (
                        <div id={`timeline-details-${event.id}`} className="timeline-event-details">
                          <h4 className="timeline-event-details-title">More details</h4>
                          <dl className="timeline-event-facts">
                            <dt>When it happened</dt><dd>{formatDateTime(event.occurred_at)}{event.occurred_at_timezone ? ` (${event.occurred_at_timezone})` : ""}</dd>
                            <dt>When it was saved</dt><dd>{formatDateTime(event.recorded_at)}</dd>
                            <dt>What is known</dt><dd>{caregiverStatusLabel(event.status) || caregiverInformationLabel(event.status) || "Not recorded"}</dd>
                            <dt>How the date was described</dt><dd>{caregiverStatusLabel(event.time_provenance) || "Not recorded"}</dd>
                            <dt>Who shared it</dt><dd>{caregiverSafeAssistantText(event.source_label) || (event.created_by_caregiver_id ? "Caregiver" : "Not recorded")}</dd>
                            <dt>Type of update</dt><dd>{event.source_type === "correction" ? "Correction" : event.source_type === "evidence" ? "Document" : event.source_type === "appointment" ? "Appointment" : event.source_type === "professional" ? "Healthcare professional" : event.created_by_caregiver_id ? "Caregiver" : "Care update"}</dd>
                            {event.source_type === "correction" && event.target_id && (
                              <>
                                <dt>Related update</dt>
                                <dd>
                                  {event.target_type === "care_event" || event.target_type === "care_assertion" ? (
                                    <a href={`#timeline-event-${event.target_id}`}>Original care event</a>
                                  ) : (
                                    "Original saved detail"
                                  )}
                                  
                                </dd>
                              </>
                            )}
                            <dt>Related care topic</dt><dd>{event.situation_id ? "Available" : "Not recorded"}</dd>
                            <dt>Related notes or documents</dt><dd>{event.evidence_ids?.length ? `${event.evidence_ids.length} saved item(s)` : "None attached"}</dd>
                            <dt>Labels</dt><dd>{event.tags?.length ? event.tags.map(tag => caregiverStatusLabel(tag) || "Care update").join(", ") : "None recorded"}</dd>
                            <dt>Updated</dt><dd>{formatDateTime(event.updated_at)}</dd>
                          </dl>
                          {event.significance_verdict && <p className="timeline-event-significance"><strong>Why this may matter:</strong> {caregiverSafeAssistantText(event.significance_verdict) || "No further explanation is available."}</p>}
                          {event.capture_processing?.review_required && event.capture_processing.analysis_id && (
                            <div className="timeline-correction-area">
                              <p className="timeline-correction-note">SolenOS found details in this update that have not been added to the Care Record. Check them before deciding whether to keep them.</p>
                              <Button variant="secondary" onClick={() => setReviewAnalysisId(event.capture_processing?.analysis_id || null)}>
                                Review suggested details
                              </Button>
                            </div>
                          )}
                          {(event.source_type === "care_event" || (
                            event.source_type === "care_assertion" &&
                            !["superseded", "retracted"].includes(event.status.toLowerCase())
                          )) && (
                            <div className="timeline-correction-area">
                              <button
                                type="button"
                                onClick={() => {
                                  setCorrectionTargetId(correctionTargetId === event.id ? null : event.id);
                                  setCorrectionText("");
                                  setCorrectionReason("");
                                  setCorrectionIdempotencyKey(null);
                                  setCorrectionMessage("");
                                }}
                                className="timeline-correction-trigger"
                              >
                                {correctionTargetId === event.id ? "Close correction" : "Suggest a correction"}
                              </button>
                              {correctionTargetId === event.id && (
                                <form className="timeline-correction-form" onSubmit={(submitEvent) => { submitEvent.preventDefault(); void submitCorrection(event); }}>
                                  <p className="timeline-correction-note">
                                    This adds a separate correction record. It does not erase or silently rewrite the original entry.
                                  </p>
                                  <label className="timeline-correction-label">
                                    What should be corrected?
                                    <textarea
                                      value={correctionText}
                                      onChange={(inputEvent) => { setCorrectionText(inputEvent.target.value); setCorrectionIdempotencyKey(null); }}
                                      rows={4}
                                      maxLength={4000}
                                      required
                                      placeholder="Describe the accurate information."
                                      className="timeline-correction-input"
                                    />
                                  </label>
                                  <label className="timeline-correction-label">
                                    Reason (optional)
                                    <input
                                      value={correctionReason}
                                      onChange={(inputEvent) => { setCorrectionReason(inputEvent.target.value); setCorrectionIdempotencyKey(null); }}
                                      maxLength={1000}
                                      placeholder="Why is this correction needed?"
                                      className="timeline-correction-input"
                                    />
                                  </label>
                                  <button type="submit" disabled={correctionSaving || !correctionText.trim()} className="timeline-correction-submit">
                                    {correctionSaving ? "Saving correction…" : "Save correction"}
                                  </button>
                                </form>
                              )}
                            </div>
                          )}
                          <p className="timeline-event-provenance-note">This update shows only the details saved at the time. Missing information is not guessed.</p>
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
        <div className="timeline-correction-status" role="status">
          <span>{correctionMessage}</span>
          {(pendingCorrectionId || events.some((item) => item.source_type === "correction" && ["pending", "processing"].includes(item.processing_status || ""))) && (
            <Button variant="secondary" disabled={retryingCorrection} onClick={() => void retryPendingCorrection()}>
              {retryingCorrection ? "Checking update…" : "Retry Care Record update"}
            </Button>
          )}
        </div>
      )}

      {historyCoverage.hasMore && (
        <div className="timeline-load-more">
          <Button variant="secondary" disabled={loadingMore} onClick={() => void loadMoreEvents()}>
            {loadingMore ? "Loading older records…" : "Load older care records"}
          </Button>
          <span className="timeline-coverage" role="status">
            Showing {events.length} of {historyCoverage.total} matching care updates.
          </span>
        </div>
      )}

      {personId && (
        <section className="timeline-change-history" aria-label="Care changes over time">
          <details
            ref={changeHistoryDetailsRef}
            className="timeline-history-details"
            onToggle={(event) => setChangeHistoryOpen(event.currentTarget.open)}
          >
            <summary className="timeline-change-summary">How the care picture has changed</summary>
            {changeHistoryOpen && (
              <>
                <ChangeIntelligencePanel personId={personId} />
                <CareChangeHistoryPanel personId={personId} />
              </>
            )}
          </details>
        </section>
      )}

      {reviewAnalysisId && (
        <CaptureAnalysisReview
          analysisId={reviewAnalysisId}
          onClose={() => setReviewAnalysisId(null)}
          onReviewed={() => {
            void loadEvents(true, appliedQuery);
            window.dispatchEvent(new Event("careRecordUpdated"));
          }}
        />
      )}

      <footer className="timeline-provenance-footer">
        <ShieldCheck className="timeline-provenance-icon" size={16} aria-hidden />
        <span>Updates are shown by when they happened, while keeping the date they were saved. A suggested interpretation is not treated as confirmed, and timing alone does not prove cause.{loadedAt ? ` Last loaded ${formatDateTime(loadedAt)}.` : ""}</span>
      </footer>
    </div>
  );
}
