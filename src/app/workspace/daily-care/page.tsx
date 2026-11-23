"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { ensureAnonymousSession, getCaregiverId, getJSON, getPersonId } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { BrandLoading } from "@/components/brand";
import QuickDailyCheckIn from "@/components/workflows/QuickDailyCheckIn";
import NaturalLanguageDailyUpdate from "@/components/workflows/NaturalLanguageDailyUpdate";
import DailyCareOfflineQueueNotice from "@/components/workflows/DailyCareOfflineQueueNotice";
import DailyCarePhotoCapture from "@/components/workflows/DailyCarePhotoCapture";
import CaptureAnalysisReview from "@/components/workflows/CaptureAnalysisReview";
import { caregiverInformationLabel, caregiverSafeAssistantText, caregiverSafeGeneratedText, caregiverStatusLabel } from "@/lib/caregiver-language";
import { RecordState } from "@/components/ui/RecordState";

const StructuredDailyCapture = dynamic(
  () => import("@/components/workflows/StructuredDailyCapture"),
  {
    ssr: false,
    loading: () => <BrandLoading animate message="Opening daily care…" />,
  },
);

type CaptureMode = "something" | "medicine" | "measurement" | "photo" | "checkin" | "note";

type DailyCareDeliveryIssue = {
  id: string;
  title: string;
  message: string;
};

type DailyCareFollowUp = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  deadline_at?: string | null;
  priority?: string | null;
};

type DailyCareDocumentStatus = {
  evidence_id: string;
  document_name: string;
  uploaded_at?: string | null;
  processing_status: string;
  page_count?: number | null;
  processed_page_count?: number | null;
  processed_page_numbers?: number[];
  unprocessed_page_numbers?: number[];
  unreadable_page_numbers?: number[];
  retryable_page_numbers?: number[];
  retry_exhausted_page_numbers?: number[];
  retry_scheduled?: boolean;
  retry_required?: boolean;
  review_required?: boolean;
  written_to_lcr?: boolean;
  medication_report_saved?: boolean;
  medication_conflict?: boolean;
  accepted_follow_up_ids?: string[];
};

type CareItem = {
  id?: string;
  source_id?: string;
  title?: string;
  description?: string | null;
  text?: string | null;
  occurred_at?: string | null;
  observed_at?: string | null;
  recorded_at?: string | null;
  status?: string | null;
  kind?: string | null;
  epistemic_status?: string | null;
  source_label?: string | null;
  original_text?: string | null;
  corrected_text?: string | null;
  reason?: string | null;
  processing_status?: string | null;
  processing_attempts?: number;
  scheduled_at?: string | null;
  uploaded_at?: string | null;
  source_type?: string | null;
  event_type?: string | null;
  created_by_caregiver_id?: string | null;
  created_at?: string | null;
  capture_processing?: {
    analysis_id?: string | null;
    extraction_status?: string | null;
    job_status?: string | null;
    job_id?: string | null;
    review_required?: boolean;
    message?: string | null;
  } | null;
};

function historyRecordId(item: CareItem): string {
  return item.id || item.source_id || "";
}

function displayCareTime(value?: string | null): string {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time not recorded"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function isOpenMatter(item: CareItem): boolean {
  return new Set([
    "Conflict",
    "Information that needs checking",
    "Care information review",
    "reconciliation_review",
    "Needs clarification",
    "Information missing",
    "Open question",
    "Follow-up",
    "Care event needing attention",
  ]).has(item.kind || "");
}

function displayHistorySource(item: CareItem): string {
  if (item.source_label && item.source_label !== "Source label not recorded") {
    const normalized = item.source_label.trim().toLowerCase();
    if (normalized === "system-generated update") return "SolenOS update";
    if (normalized === "professional contribution") return "Shared by a care professional";
    return caregiverSafeGeneratedText(item.source_label) || "Saved care record";
  }
  if (item.source_type === "caregiver_report" || item.source_type === "care_event" || item.created_by_caregiver_id) {
    return "Recorded by caregiver";
  }
  if (item.source_type === "system" || item.source_type === "system_generated") {
    return "SolenOS update";
  }
  if (item.source_type === "professional" || item.source_type === "verified_professional") {
    return "Shared by a care professional";
  }
  return "Who added this is not recorded";
}

function displayHistoryTime(item: CareItem): string {
  const eventTime = item.occurred_at || item.observed_at;
  const recordedTime = item.recorded_at || item.uploaded_at;
  if (eventTime && recordedTime) {
    const eventDate = new Date(eventTime);
    const recordedDate = new Date(recordedTime);
    if (!Number.isNaN(eventDate.getTime()) && !Number.isNaN(recordedDate.getTime()) &&
        Math.abs(eventDate.getTime() - recordedDate.getTime()) > 60_000) {
      return `Happened: ${displayCareTime(eventTime)} · Recorded: ${displayCareTime(recordedTime)}`;
    }
  }
  if (eventTime) return `Happened: ${displayCareTime(eventTime)}`;
  if (item.scheduled_at) return `Scheduled for: ${displayCareTime(item.scheduled_at)}`;
  if (recordedTime) return `Recorded: ${displayCareTime(recordedTime)}`;
  return "Time not recorded";
}

function classifyHistoryRecord(item: CareItem): "observations" | "medicines" | "measurements" | "checkIns" | "handoffs" | "updates" {
  const eventType = (item.event_type || "").toLowerCase();
  if (eventType.includes("handoff")) return "handoffs";
  if (eventType.includes("checkin") || eventType.includes("check_in")) return "checkIns";
  const raw = item.text || item.description || "";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const detail = (parsed.original_capture && typeof parsed.original_capture === "object"
      ? parsed.original_capture
      : parsed) as Record<string, unknown>;
    if (detail.quick_check_in) return "checkIns";
    if (Array.isArray(detail.medications) && detail.medications.length) return "medicines";
    if (Array.isArray(detail.vitals) && detail.vitals.length) return "measurements";
    if (typeof detail.capture_kind === "string" && ["something", "note"].includes(detail.capture_kind)) return "observations";
  } catch {
    // Older entries may not have a structured capture payload.
  }
  if (eventType.includes("observation") || item.source_type === "caregiver_report") return "observations";
  return "updates";
}

function displayHistoryText(item: CareItem): string {
  if (item.source_type === "correction" && (item.original_text || item.corrected_text)) {
    return [
      item.original_text ? `Earlier entry: ${item.original_text.trim() || "An earlier entry was saved."}` : "",
      item.corrected_text ? `Correction: ${item.corrected_text.trim() || "A correction was saved."}` : "",
      item.reason ? `Reason: ${item.reason.trim() || "A reason was recorded."}` : "",
      item.processing_status === "completed" ? "Care Record updated" : ["pending", "processing"].includes(item.processing_status || "") ? "Care Record update still pending" : "",
    ].filter(Boolean).join(" · ");
  }

  const raw = item.text || item.description || "";
  if (!raw) return item.reason?.trim() || "";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return raw.trim() || "Saved care information";
    const capture = (parsed.original_capture && typeof parsed.original_capture === "object"
      ? parsed.original_capture
      : parsed) as Record<string, unknown>;
    const quick = (capture.quick_check_in && typeof capture.quick_check_in === "object"
      ? capture.quick_check_in
      : null) as Record<string, unknown> | null;
    const parts: string[] = [];

    if (quick && typeof quick.kind === "string") {
      const labels: Record<string, string> = {
        same_as_usual: "About the same as usual",
        change: "Some things were different",
        uncertain: "It was hard to tell",
        concern: "Caregiver reported a concern",
        care_completed: "Care support was reported",
      };
      parts.push(labels[quick.kind] || "Quick check-in recorded");
    }

    const note = typeof quick?.note === "string" && quick.note.trim()
      ? quick.note.trim()
      : typeof capture.notes === "string" && capture.notes.trim()
        ? capture.notes.trim()
        : typeof capture.original_notes === "string" && capture.original_notes.trim()
          ? capture.original_notes.trim()
          : "";
    if (note) parts.push(note);

    if (Array.isArray(capture.medications)) {
      for (const value of capture.medications) {
        if (!value || typeof value !== "object") continue;
        const medicine = value as Record<string, unknown>;
        const name = typeof medicine.medication_name === "string" ? medicine.medication_name : "Medicine";
        const status = typeof medicine.status === "string" ? medicine.status : "not_recorded";
        const statusLabels: Record<string, string> = {
          given: "reported given",
          not_given: "reported not given",
          uncertain: "not sure whether it was given",
          scheduled: "scheduled; not confirmed as given",
          other: "other medicine event",
          refused: "reported refused",
          missed: "reported missed",
        };
        const scheduledFor = typeof medicine.scheduled_for === "string"
          ? ` (scheduled for ${displayCareTime(medicine.scheduled_for)})`
          : "";
        parts.push(`${name.trim() || "Medicine"}: ${statusLabels[status] || caregiverStatusLabel(status) || "Status not recorded"}${scheduledFor}`);
      }
    }

    if (Array.isArray(capture.vitals)) {
      for (const value of capture.vitals) {
        if (!value || typeof value !== "object") continue;
        const vital = value as Record<string, unknown>;
        const type = typeof vital.measurement_name === "string" && vital.measurement_name.trim()
          ? vital.measurement_name.trim()
          : typeof vital.vital_type === "string" ? ({ blood_pressure: "Blood pressure", heart_rate: "Heart rate", temperature: "Temperature", oxygen_saturation: "Oxygen level", weight: "Weight", blood_glucose: "Blood sugar", respiratory_rate: "Breathing rate" } as Record<string, string>)[vital.vital_type] || "Measurement" : "Measurement";
        const reading = vital.value;
        const unit = typeof vital.unit === "string" ? vital.unit : "";
        if (typeof reading === "number" || typeof reading === "string") {
          parts.push(`${type.trim() || "Measurement"}: ${reading}${unit ? ` ${unit}` : ""}`);
        }
      }
    }

    return parts.length ? parts.join(" · ") : "Saved care information";
  } catch {
    return raw.trim() || "Saved care information";
  }
}

function careEventTimestamp(item: CareItem): string | null {
  // Group and order care by when it happened, not when someone later entered it.
  // Fall back to the recording time only when the source has no event/observation time.
  return item.occurred_at || item.observed_at || item.recorded_at || item.uploaded_at || item.created_at || null;
}

function wasRecordedToday(item: CareItem, now = new Date()): boolean {
  const value = careEventTimestamp(item);
  if (!value) return false;
  const recorded = new Date(value);
  return !Number.isNaN(recorded.getTime())
    && recorded.getFullYear() === now.getFullYear()
    && recorded.getMonth() === now.getMonth()
    && recorded.getDate() === now.getDate();
}

function dailyTimePeriod(item: CareItem): "morning" | "afternoon" | "evening" | "other" {
  const value = careEventTimestamp(item);
  if (!value) return "other";
  const recorded = new Date(value);
  if (Number.isNaN(recorded.getTime())) return "other";
  if (recorded.getHours() < 12) return "morning";
  if (recorded.getHours() < 17) return "afternoon";
  return "evening";
}

function isUnconfirmedMedicationChange(text: string): boolean {
  return /\b(medication|medicine|dose|dosage|prescription)\b/i.test(text)
    && /\b(changed|change|new dose|adjusted|increased|decreased|reduced|stopped)\b/i.test(text)
    && /\b(i think|maybe|might|may have|not sure|cannot remember|can't remember|don't remember|forgot)\b/i.test(text);
}

export default function DailyCarePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [captureOpen, setCaptureOpen] = useState(true);
  const [captureMode, setCaptureMode] = useState<CaptureMode | null>("something");
  const [reviewAnalysisId, setReviewAnalysisId] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [careItems, setCareItems] = useState<CareItem[]>([]);
  const [historyItems, setHistoryItems] = useState<CareItem[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [followUps, setFollowUps] = useState<DailyCareFollowUp[]>([]);
  const [followUpsError, setFollowUpsError] = useState("");
  const [documents, setDocuments] = useState<DailyCareDocumentStatus[]>([]);
  const [documentsError, setDocumentsError] = useState("");
  const [deliveryIssues, setDeliveryIssues] = useState<DailyCareDeliveryIssue[]>([]);
  const [deliveryStatusError, setDeliveryStatusError] = useState("");
  const [sinceLastOpenItems, setSinceLastOpenItems] = useState<CareItem[] | null>(null);
  const [lastOpenedAt, setLastOpenedAt] = useState<string | null>(null);
  const [historyMayBeTruncated, setHistoryMayBeTruncated] = useState(false);
  const visitBaselineRef = useRef<{ initialized: boolean; previousVisit: string | null }>({
    initialized: false,
    previousVisit: null,
  });
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState("");
  const hasContextLoadedRef = useRef(false);

  useEffect(() => {
    let active = true;
    if (!hasContextLoadedRef.current) setContextLoading(true);
    setContextError("");
    void ensureAnonymousSession()
      .then(() => {
        if (!active) return;
        // Make capture and each persisted section independent. A slow history,
        // notification or document read must not hide an already-saved follow-up.
        setReady(true);

        const carePromise = getJSON("/care-continuity/current-care?limit_per_source=20")
          .then((value) => {
            if (!active) return false;
            const payload = value as {
              items?: unknown;
              schema_status?: string;
              missing_required_sources?: string[];
              missing_optional_sources?: string[];
              failed_sources?: string[];
            };
            if (Array.isArray(payload?.items)) {
              setCareItems(payload.items as CareItem[]);
              hasContextLoadedRef.current = true;
              const incomplete = payload.schema_status !== "complete"
                || (payload.missing_required_sources?.length ?? 0) > 0
                || (payload.missing_optional_sources?.length ?? 0) > 0
                || (payload.failed_sources?.length ?? 0) > 0;
              setContextError(incomplete
                ? "Some saved care information could not be fully checked. This view may be incomplete; refresh the record to try again."
                : "");
              return true;
            }
            setContextError("Saved care information could not be read. Your existing information is still shown.");
            return false;
          })
          .catch(() => {
            if (active) setContextError("Current care information could not be loaded. Try refreshing the record.");
            return false;
          });

        const historyPromise = getJSON("/daily-care/intelligence/history?limit=200&offset=0")
          .then((value) => {
            if (!active) return null;
            const payload = value as { records?: unknown; page?: { has_more?: boolean } };
            if (!Array.isArray(payload?.records)) {
              setHistoryError("Recent care history could not be read. The daily summary is unavailable.");
              return null;
            }
            const records = payload.records as CareItem[];
            setHistoryError("");
            setHistoryItems(records);
            setHistoryMayBeTruncated(Boolean(payload.page?.has_more));
            return records;
          })
          .catch(() => {
            if (active) setHistoryError("Recent care history could not be loaded. The daily summary is unavailable.");
            return null;
          });

        void getJSON("/open-loops?limit=100&offset=0")
          .then((value) => {
            if (!active) return;
            const payload = value as { items?: unknown };
            if (Array.isArray(payload?.items)) {
              const items = payload.items as DailyCareFollowUp[];
              setFollowUps(items.filter((item) => !["closed", "cancelled"].includes(item.status)));
              setFollowUpsError("");
            } else {
              setFollowUpsError("The saved follow-up list could not be read. Check it before assuming nothing is outstanding.");
            }
          })
          .catch(() => {
            if (active) setFollowUpsError("Existing follow-ups could not be loaded. Check them before assuming nothing is outstanding.");
          });

        void getJSON("/documents/status?limit=10")
          .then((value) => {
            if (!active) return;
            const payload = value as { items?: unknown };
            if (Array.isArray(payload?.items)) {
              setDocuments(payload.items as DailyCareDocumentStatus[]);
              setDocumentsError("");
            } else {
              setDocumentsError("We couldn't check whether your document has finished. Open Documents to see its latest update.");
            }
          })
          .catch(() => {
            if (active) setDocumentsError("We couldn't check the document's progress. Open Documents to see its latest update.");
          });

        void getJSON("/notifications?limit=100&offset=0")
          .then((value) => {
            if (!active) return;
            const payload = value as {
              items?: Array<{
                id?: string;
                title?: string;
                status?: string;
                push_delivery?: { status?: string; message?: string } | null;
              }>;
            };
            if (Array.isArray(payload?.items)) {
              const issues = payload.items.filter((item) =>
                item.status === "active"
                && ["failed", "expired"].includes(item.push_delivery?.status || "")
              );
              setDeliveryIssues(issues.map((item) => ({
                id: item.id || `delivery-issue-${issues.indexOf(item)}`,
                title: caregiverSafeGeneratedText(item.title) || "Care notification",
                message: caregiverSafeGeneratedText(item.push_delivery?.message) || "This notification could not be sent to this device. It remains in your SolenOS inbox.",
              })));
              setDeliveryStatusError("");
            } else {
              setDeliveryStatusError("We couldn’t check whether a notification reached this device just now.");
            }
          })
          .catch(() => {
            if (active) setDeliveryStatusError("We couldn’t check whether a notification reached this device just now.");
          });

        // Current care and history control the page-level context loading state.
        // Follow-ups, documents and notification status update as their own reads finish.
        void Promise.all([carePromise, historyPromise]).then(([careLoaded, records]) => {
          if (!active) return;
          setContextLoading(false);
          if (!careLoaded || !records) {
            setSinceLastOpenItems(null);
            setLastOpenedAt(null);
            return;
          }

          const personId = getPersonId();
          const caregiverId = getCaregiverId();
          if (!personId || !caregiverId) {
            setSinceLastOpenItems(null);
            setLastOpenedAt(null);
            return;
          }

          const visitKey = `solenos:daily-care:last-opened:${personId}:${caregiverId}`;
          if (!visitBaselineRef.current.initialized) {
            let previousVisit: string | null = null;
            try {
              previousVisit = window.localStorage.getItem(visitKey);
            } catch {
              previousVisit = null;
            }
            visitBaselineRef.current = { initialized: true, previousVisit };
            setLastOpenedAt(previousVisit);
            try {
              window.localStorage.setItem(visitKey, new Date().toISOString());
            } catch {
              // History remains available if this browser blocks local storage.
            }
          }

          const previousVisit = visitBaselineRef.current.previousVisit;
          if (previousVisit) {
            const previousTime = new Date(previousVisit).getTime();
            const newlyRecorded = records.filter((item) => {
              const recorded = item.recorded_at || item.uploaded_at || item.created_at;
              if (!recorded) return false;
              const recordedTime = new Date(recorded).getTime();
              return Number.isFinite(recordedTime) && recordedTime > previousTime;
            });
            setSinceLastOpenItems(newlyRecorded);
          } else {
            setSinceLastOpenItems(null);
          }
        });
      })
      .catch(() => {
        if (!active) return;
        setError("We couldn’t open daily care. Check your connection and try again.");
        setContextLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshVersion]);

  useEffect(() => {
    const refresh = () => setRefreshVersion((value) => value + 1);
    window.addEventListener("careRecordUpdated", refresh);
    return () => window.removeEventListener("careRecordUpdated", refresh);
  }, []);

  useEffect(() => {
    const pendingJobIds = Array.from(new Set(
      historyItems
        .filter((item) => ["queued", "processing"].includes(item.capture_processing?.job_status || ""))
        .map((item) => item.capture_processing?.job_id)
        .filter((value): value is string => Boolean(value))
    )).slice(0, 10);
    if (!pendingJobIds.length) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      const results = await Promise.allSettled(
        pendingJobIds.map((jobId) => getJSON(`/assistant/jobs/${jobId}`))
      );
      if (!active) return;
      const finished = results.some((result) =>
        result.status === "fulfilled"
        && ["completed", "failed", "cancelled"].includes(
          String((result.value as { status?: string })?.status || "")
        )
      );
      if (finished) {
        setRefreshVersion((value) => value + 1);
        return;
      }
      timer = setTimeout(poll, 5000);
    };
    timer = setTimeout(poll, 3000);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [historyItems]);

  const todayItems = historyItems
    .filter((item) => wasRecordedToday(item))
    .sort((left, right) => {
      const leftTime = new Date(careEventTimestamp(left) || 0).getTime();
      const rightTime = new Date(careEventTimestamp(right) || 0).getTime();
      return leftTime - rightTime;
    });
  const captureStatusHistoryItems = historyItems
    .filter((item) => {
      const processing = item.capture_processing;
      return Boolean(processing && (
        processing.review_required
        || ["queued", "processing", "failed"].includes(processing.job_status || "")
        || ["failed", "unavailable"].includes(processing.extraction_status || "")
      ));
    })
    .sort((left, right) => {
      const leftTime = new Date(careEventTimestamp(left) || 0).getTime();
      const rightTime = new Date(careEventTimestamp(right) || 0).getTime();
      return rightTime - leftTime;
    });
  const medicationConcern = [...todayItems].reverse().find((item) =>
    isUnconfirmedMedicationChange(displayHistoryText(item))
  ) || null;
  const todayPeriods = [
    { key: "morning", label: "Morning" },
    { key: "afternoon", label: "Afternoon" },
    { key: "evening", label: "Evening" },
    { key: "other", label: "Other time" },
  ] as const;

  return (
    <div className="mobile-screen daily-care-screen">
      <div className="daily-care-page-head">
        <Button
          variant="secondary"
          className="daily-care-back-button"
          aria-label="Back to care record"
          onClick={() => router.push("/workspace")}
        >
          <ArrowLeft size={18} aria-hidden />
          <span>Care Record</span>
        </Button>
        <div>
          <p className="daily-care-eyebrow"><CalendarDays size={15} aria-hidden /> DAILY CARE</p>
          <h1>Share an update</h1>
          <p>Tell SolenOS what happened, what you noticed or what you want to remember. Use your own words; you do not need to choose a category.</p>
        </div>
      </div>

      {error ? (
        <section className="daily-care-error" role="alert">
          <h2>Daily Care could not be opened</h2>
          <p>{caregiverSafeAssistantText(error) || "Daily Care could not be opened. Check your connection and try again."}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>Try again</Button>
        </section>
      ) : ready ? (
        <>
          <section aria-labelledby="daily-care-current-title" className="daily-care-context-panel">
            <h2 id="daily-care-current-title">Where things stand</h2>
            <p className="daily-care-muted">The latest care information saved so far.</p>
            {contextLoading ? (
              <RecordState kind="loading" title="Loading care information" />
            ) : contextError && careItems.filter((item) => !isOpenMatter(item)).length === 0 ? (
              <RecordState kind="error" description={contextError} onAction={() => setRefreshVersion((value) => value + 1)} />
            ) : careItems.filter((item) => !isOpenMatter(item)).length > 0 ? (
              <ul className="daily-care-record-list">
                {careItems.filter((item) => !isOpenMatter(item)).slice(0, 2).map((item, index) => (
                  <li key={item.id || `care-item-${index}`}>
                    <strong>{caregiverSafeAssistantText(item.title) || "Care update"}</strong>
                    {displayHistoryText(item) && <p className="daily-care-summary-detail">{displayHistoryText(item)}</p>}
                    <span>{displayHistoryTime(item)}</span>

                    <span> · {displayHistorySource(item)}</span>
                    {caregiverInformationLabel(item.epistemic_status) && <span> · {caregiverInformationLabel(item.epistemic_status)}</span>}
                    {caregiverStatusLabel(item.status) && <span> · {caregiverStatusLabel(item.status)}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <RecordState kind="first-empty" title="No care updates recorded yet" description="Recorded care updates will appear here when they are added." onAction={() => setCaptureOpen(true)} />
            )}
            {contextError && careItems.length > 0 && <p role="status" className="daily-care-muted">{caregiverSafeAssistantText(contextError) || "Some care information could not be loaded. Your previously saved information is still shown."}</p>}
          </section>

          <DailyCareOfflineQueueNotice />
          <section aria-labelledby="daily-care-capture-title" className="daily-care-context-panel">
            <h2 id="daily-care-capture-title">Anything different today?</h2>
            <p className="daily-care-muted">Share something, check in, or leave things as they are. Nothing is required.</p>
            <Button
              variant="primary"
              aria-expanded={captureOpen}
              onClick={() => {
                if (captureOpen) {
                  setCaptureOpen(false);
                  setCaptureMode(null);
                } else {
                  setCaptureOpen(true);
                }
              }}
            >
              {captureOpen ? "Close capture" : "Share something"}
            </Button>
            {captureOpen && (
              <div className="daily-care-capture-state">
                {!captureMode ? (
                  <div role="group" aria-label="Choose what you want to share" className="daily-care-capture-options">
                    {([
                      { value: "something", label: "Something happened", detail: "Share an observation in your own words." },
                      { value: "medicine", label: "Medicine", detail: "Record what happened with a medicine." },
                      { value: "measurement", label: "Measurement", detail: "Record a reading that was actually taken." },
                      { value: "photo", label: "Photograph", detail: "Add a photo to your care information." },
                      { value: "checkin", label: "Quick check-in", detail: "Share one overall impression of today." },
                      { value: "note", label: "Note", detail: "Save a short note without categorizing it." },
                    ] as const).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className="daily-care-capture-option"
                        onClick={() => setCaptureMode(option.value)}
                      >
                        <strong>{option.label}</strong>
                        <span>{option.detail}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="daily-care-capture-mode-heading">
                      <strong>{({
                        something: "Something happened",
                        medicine: "Medicine",
                        measurement: "Measurement",
                        photo: "Photograph",
                        checkin: "Quick check-in",
                        note: "Note",
                      } as const)[captureMode]}</strong>
                      <Button variant="secondary" onClick={() => setCaptureMode(null)}>More ways to share</Button>
                      <Link href="/workspace/documents" className="solenos-care-secondary-action">Add a document</Link>
                    </div>
                    {captureMode === "checkin" ? (
                      <QuickDailyCheckIn />
                    ) : captureMode === "photo" ? (
                      <DailyCarePhotoCapture />
                    ) : captureMode === "something" ? (
                      <NaturalLanguageDailyUpdate />
                    ) : (
                      <StructuredDailyCapture mode={captureMode} />
                    )}
                  </>
                )}
              </div>
            )}
          </section>

          <details className="daily-care-context-panel">
            <summary><h2 id="daily-care-documents-title">Recent documents</h2></summary>
            <p className="daily-care-muted">SolenOS keeps the original files and shows what it could read from them.</p>
            {documentsError ? (
              <p role="alert">{caregiverSafeAssistantText(documentsError) || "Your documents could not be loaded. Try again."}</p>
            ) : documents.length ? (
              <ul className="daily-care-record-list">
                {documents.slice(0, 5).map((item) => {
                  const statusText: Record<string, string> = {
                    uploaded: "Uploaded. SolenOS has not started reading it yet.",
                    queued: "SolenOS is reading this document. You do not need to stay on this screen.",
                    processing: "SolenOS is reading this document. You do not need to stay on this screen.",
                    processed: "SolenOS has read the pages it could. Check below to see whether anything needs your review.",
                    partially_processed: "SolenOS could not finish reading every page.",
                    retry_required: "SolenOS could not finish reading this document. The original file is still saved.",
                    review_required: "SolenOS has finished reading it. Check the suggested details before adding them to your Care Record.",
                    failed: "SolenOS could not read this document. The original file is still saved.",
                    cancelled: "Reading this document was stopped.",
                  };
                  const unreadable = item.unreadable_page_numbers || [];
                  const unprocessed = item.unprocessed_page_numbers || [];
                  const processed = item.processed_page_numbers || [];
                  return (
                    <li key={item.evidence_id}>
                      <strong>{caregiverSafeAssistantText(item.document_name) || "Uploaded document"}</strong>
                      <p>{statusText[item.processing_status] || "Open Documents to see the latest update."}</p>
                      {typeof item.page_count === "number" && <span>SolenOS read {typeof item.processed_page_count === "number" ? item.processed_page_count : processed.length} of {item.page_count} pages</span>}
                      {item.retry_scheduled && <p>SolenOS is trying to read the unfinished pages again. You do not need to stay on this screen.</p>}
                      {(item.retry_exhausted_page_numbers || []).length > 0 && <p>SolenOS retried page{item.retry_exhausted_page_numbers!.length === 1 ? "" : "s"} {item.retry_exhausted_page_numbers!.join(", ")} but could not read them. The original file is still saved, and the document is marked as incomplete.</p>}
                      {unreadable.length > 0 && <p>Page{unreadable.length === 1 ? "" : "s"} {unreadable.join(", ")} could not be read clearly. SolenOS has not assumed that those pages contain nothing important.</p>}
                      {unprocessed.length > 0 && <p>Page{unprocessed.length === 1 ? "" : "s"} {unprocessed.join(", ")} still need to be read.</p>}
                      {item.medication_conflict && <p role="status">The document appears to differ from the current medication record. The instruction is unconfirmed. Confirm the current instruction with the prescribing professional or pharmacist before acting on it.</p>}
                      {item.medication_report_saved && <p>Medicine information was saved as a report, but it has not been confirmed. Your existing medicine list was not changed.</p>}
                      {item.written_to_lcr && !item.medication_report_saved && <span> · Reviewed details saved to your Care Record</span>}
                      {(item.accepted_follow_up_ids || []).length > 0 && <span> · Follow-up added to your existing follow-ups</span>}
                      {item.review_required && <p><Link href="/workspace/documents">Review the document</Link></p>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>No documents have been uploaded from this account yet.</p>
            )}
            <Button variant="secondary" onClick={() => router.push("/workspace/documents")}>Open documents</Button>
          </details>

          <details className="daily-care-context-panel">
            <summary><h2 id="daily-care-follow-ups-title">Follow-ups</h2></summary>
            <p className="daily-care-muted">
              {followUps.length} saved follow-up{followUps.length === 1 ? "" : "s"} and {careItems.filter(isOpenMatter).length} care detail{careItems.filter(isOpenMatter).length === 1 ? "" : "s"} that may need checking.
              Keep questions, decisions and things still needing attention in one place. If a follow-up already exists, Daily Care will use it instead of creating a duplicate.
            </p>
            {followUpsError && <p role="alert">{caregiverSafeAssistantText(followUpsError) || "Your follow-ups could not be loaded. Try again."}</p>}
            {followUps.length > 0 && (
              <ul aria-label="Saved follow-ups" className="daily-care-follow-up-list">
                {followUps.slice(0, 4).map((item) => (
                  <li key={item.id} className="daily-care-follow-up-item">
                    <strong>{caregiverSafeAssistantText(item.title) || "Follow-up"}</strong>
                    {item.description && (
                      <p>{caregiverSafeAssistantText(item.description)}</p>
                    )}
                    <div className="daily-care-follow-up-meta">
                      <span>{caregiverStatusLabel(item.status)}</span>
                      {item.deadline_at && <span>Due {displayCareTime(item.deadline_at)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!followUps.length && !followUpsError && (
              <p className="daily-care-follow-up-empty">There are no open follow-ups saved right now.</p>
            )}
            {deliveryIssues.length > 0 && (
              <div role="status" className="daily-care-medication-confirmation">
                <strong>A notification could not be sent</strong>
                {deliveryIssues.slice(0, 3).map((issue) => (
                  <p key={issue.id}>{issue.title}: {caregiverSafeGeneratedText(issue.message) || "This notification could not be sent. Your in-app updates remain available."}</p>
                ))}
              </div>
            )}
            {deliveryStatusError && <p role="status">{deliveryStatusError}</p>}
            <Button variant="secondary" asChild><Link href="/workspace/open-loops">Open Follow-ups</Link></Button>
          </details>

          <details className="daily-care-context-panel">
            <summary><h2 id="daily-care-since-last-title">Since you last opened Daily Care</h2></summary>
            <p className="daily-care-muted">
              Shows care updates added since your previous visit on this device.
            </p>
            {historyError && <p role="status" className="daily-care-muted">This summary could not be refreshed. Previously saved care information remains available below.</p>}
            {sinceLastOpenItems === null ? (
              historyError ? null : <p>This is the first visit on this device. New recorded updates will appear here the next time you open Daily Care.</p>
            ) : sinceLastOpenItems.length > 0 ? (
              <>
                <p><strong>{sinceLastOpenItems.length}</strong> new care record{sinceLastOpenItems.length === 1 ? "" : "s"} added since {lastOpenedAt ? displayCareTime(lastOpenedAt) : "your previous visit"}.</p>
                <ul className="daily-care-record-list">
                  {([
                    ["observations", "Observation records"],
                    ["medicines", "Medication event records"],
                    ["measurements", "Measurement records"],
                    ["checkIns", "Quick check-ins"],
                    ["handoffs", "Care handoffs"],
                    ["updates", "Other care updates"],
                  ] as const).filter(([key]) => sinceLastOpenItems.some((item) => classifyHistoryRecord(item) === key))
                    .map(([key, label]) => {
                      const matching = sinceLastOpenItems.filter((item) => classifyHistoryRecord(item) === key);
                      const targetId = historyRecordId(matching[0]);
                      return (
                        <li key={key}>
                          {targetId ? (
                            <a href={`#daily-care-event-${targetId}`}>
                              {matching.length} {label.toLowerCase()}
                            </a>
                          ) : (
                            <>{matching.length} {label.toLowerCase()}</>
                          )}
                        </li>
                      );
                    })}
                </ul>
                <p className="daily-care-muted">Select a count to jump to its saved entries in Recent care history below.</p>
              </>
            ) : historyError ? null : (
              <RecordState kind="period-empty" title="No new care updates recorded" description="Care updates added since your last visit will appear here." />
            )}
            {historyMayBeTruncated && <p className="daily-care-muted">This summary shows the latest 200 saved updates. Open full care history to see older ones.</p>}
          </details>

          {captureStatusHistoryItems.length > 0 && (
            <section aria-labelledby="daily-care-review-title" className="daily-care-context-panel">
              <h2 id="daily-care-review-title">Updates to check</h2>
              <p className="daily-care-muted">Your original notes are saved. Some details may need a quick check.</p>
              <ul className="daily-care-record-list">
                {captureStatusHistoryItems.map((item, index) => (
                  <li key={item.capture_processing?.analysis_id || historyRecordId(item) || ("capture-status-" + index)}>
                    <strong>{caregiverSafeAssistantText(item.title) || "Care update"}</strong>
                    {displayHistoryText(item) && <p>{displayHistoryText(item)}</p>}
                    <span>{displayHistoryTime(item)}</span>
                    {item.capture_processing?.review_required && item.capture_processing.analysis_id ? (
                      <div style={{ marginTop: 8 }}>
                        <p className="daily-care-muted">Check these details before adding them to your Care Record.</p>
                        <Button
                          variant="secondary"
                          onClick={() => setReviewAnalysisId(item.capture_processing?.analysis_id || null)}
                        >
                          Review suggested details
                        </Button>
                      </div>
                    ) : (
                      <p className="daily-care-muted">{caregiverSafeGeneratedText(item.capture_processing?.message) || (
                        ["queued", "processing"].includes(item.capture_processing?.job_status || "")
                          ? "This update is being checked. You can keep using SolenOS."
                          : "Your saved note is still available. Its details could not be organized yet."
                      )}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="daily-care-today-title" className="daily-care-context-panel">
            <h2 id="daily-care-today-title">Care today</h2>
            <p className="daily-care-muted">Updates saved today, in time order. No daily entry is required.</p>
            {medicationConcern && (
              <div role="status" className="daily-care-medication-confirmation">
                <strong>Needs confirmation</strong>
                <p>{displayHistoryText(medicationConcern)}</p>
                <p>A medication change was reported, but the new dose has not been confirmed. Check the doctor’s instructions or contact the prescribing professional before relying on a different dose.</p>
              </div>
            )}
            {historyError ? (
              <RecordState kind="error" description={historyError} onAction={() => setRefreshVersion((value) => value + 1)} />
            ) : todayItems.length ? (
              todayPeriods.map((period) => {
                const items = todayItems.filter((item) => dailyTimePeriod(item) === period.key);
                if (!items.length) return null;
                return (
                  <div key={period.key} className="daily-care-day-period">
                    <h3>{period.label}</h3>
                    <ul className="daily-care-record-list">
                      {items.map((item, index) => (
                        <li key={historyRecordId(item) || `today-${period.key}-${index}`}>
                          <strong>{caregiverSafeAssistantText(item.title) || "Care update"}</strong>
                          {displayHistoryText(item) && <p>{displayHistoryText(item)}</p>}
                          <span>{displayHistoryTime(item)}</span>

                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            ) : (
              <p>No updates have been saved today. That does not mean nothing happened, and you do not need to add an entry.</p>
            )}
          </section>

          <details className="daily-care-context-panel">
            <summary><h2>Need to review an earlier update?</h2></summary>
            <p className="daily-care-muted">Open care history to find earlier updates and any suggested details that still need your review.</p>
            <Link href="/workspace/timeline" className="care-reminders-inline-link">Open care history</Link>
          </details>
          {reviewAnalysisId && (
            <CaptureAnalysisReview
              analysisId={reviewAnalysisId}
              onClose={() => setReviewAnalysisId(null)}
              onReviewed={() => {
                setRefreshVersion((value) => value + 1);
                window.dispatchEvent(new Event("careRecordUpdated"));
              }}
            />
          )}
        </>
      ) : (
        <BrandLoading animate message="Opening your care record…" />
      )}

      <style jsx global>{`
        /* Daily Care: deliberately single-column, readable, and resilient on phones. */
        .daily-care-screen,
        .daily-care-screen *,
        .daily-care-screen *::before,
        .daily-care-screen *::after {
          box-sizing: border-box;
          min-width: 0;
        }
        .daily-care-screen {
          width: 100%;
          max-width: 100%;
          padding: clamp(.75rem, 3.5vw, 1.5rem);
          overflow-wrap: anywhere;
          word-break: normal;
        }
        .daily-care-page-head {
          width: 100%;
          max-width: 48rem;
          margin: 0 auto 1.25rem;
          gap: .65rem;
        }
        .daily-care-back-button {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          justify-content: center;
          gap: .4rem;
          min-height: 44px;
          padding-inline: .8rem;
          border-color: var(--theme-panel-border);
          color: var(--theme-panel-fg);
          font-weight: 600;
          white-space: nowrap;
        }
        .daily-care-context-panel {
          width: 100%;
          max-width: 48rem;
          margin: 0 auto 1rem;
          padding: clamp(.9rem, 3vw, 1.25rem);
          border: 1px solid var(--theme-panel-border);
          border-radius: 16px;
          background: var(--theme-panel-bg);
          color: var(--theme-panel-fg);
        }
        .daily-care-context-panel > summary {
          cursor: pointer;
          list-style-position: inside;
        }
        .daily-care-context-panel > summary h2 {
          display: inline;
          margin: 0;
        }
        .daily-care-context-panel[open] > summary {
          margin-bottom: .75rem;
        }
        .daily-care-context-panel h2 {
          margin: 0 0 .35rem;
          font-size: 1.2rem;
          line-height: 1.35;
        }
        .daily-care-muted {
          color: var(--theme-panel-muted);
          line-height: 1.55;
          margin: 0 0 .8rem;
        }
        .daily-care-summary-detail {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
          line-height: 1.45;
        }
        .daily-care-record-list {
          list-style: none;
          margin: .5rem 0 0;
          padding: 0;
        }
        .daily-care-record-list li {
          padding: .85rem 0;
          border-top: 1px solid var(--theme-panel-border);
          overflow-wrap: anywhere;
        }
        .daily-care-record-list li:first-child { border-top: 0; }
        .daily-care-record-list strong { display: block; margin-bottom: .2rem; }
        .daily-care-record-list p { margin: .25rem 0; white-space: pre-wrap; }
        .daily-care-record-list span {
          color: var(--theme-panel-muted);
          font-size: .85rem;
        }
        .daily-care-history-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: .75rem;
          flex-wrap: wrap;
        }
        .daily-care-capture-state { margin-top: 1rem; }
        .daily-care-capture-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
          gap: .65rem;
          margin-top: .9rem;
        }
        .daily-care-capture-option {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: .3rem;
          min-height: 76px;
          padding: .85rem 1rem;
          border: 1px solid var(--theme-panel-border);
          border-radius: 12px;
          background: var(--theme-field-bg);
          color: var(--theme-panel-fg);
          text-align: left;
          cursor: pointer;
        }
        .daily-care-capture-option span {
          color: var(--theme-panel-muted);
          font-size: .88rem;
          line-height: 1.4;
        }
        .daily-care-capture-mode-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: .75rem;
          margin-bottom: .9rem;
        }
        .daily-care-page-head > div { min-width: 0; flex: 1 1 auto; }
        .daily-care-page-head h1 {
          font-size: clamp(1.65rem, 6vw, 2.25rem);
          line-height: 1.15;
          letter-spacing: -.035em;
          overflow-wrap: anywhere;
          text-wrap: balance;
        }
        .daily-care-page-head p:not(.daily-care-eyebrow) {
          max-width: 42rem;
          font-size: 1rem;
          line-height: 1.6;
        }
        .daily-care-page-head .care-reminders-inline-link {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          margin-top: .5rem;
          color: var(--theme-link);
          font-weight: 650;
          text-underline-offset: 3px;
        }
        .structured-daily-capture {
          width: 100%;
          max-width: 48rem;
          margin: 0 auto;
          padding: 0;
          color: var(--theme-panel-fg);
          font-size: 1rem;
          line-height: 1.55;
          overflow-wrap: anywhere;
        }
        .structured-daily-capture h1,
        .structured-daily-capture h2,
        .structured-daily-capture h3,
        .structured-daily-capture h4,
        .structured-daily-capture p,
        .structured-daily-capture label,
        .structured-daily-capture li,
        .structured-daily-capture strong,
        .structured-daily-capture span {
          max-width: 100%;
          overflow-wrap: anywhere;
          white-space: normal;
          line-height: 1.5;
        }
        .structured-daily-capture > div:first-child {
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          justify-content: flex-start !important;
          gap: .35rem !important;
          width: 100%;
          margin-bottom: 1.25rem !important;
        }
        .structured-daily-capture > div:first-child h1 {
          margin: 0 !important;
          font-size: clamp(1.45rem, 5vw, 1.9rem) !important;
          line-height: 1.2 !important;
          letter-spacing: -.025em;
        }
        .structured-daily-capture > div:first-child p {
          max-width: 100% !important;
          margin: 0 !important;
          font-size: 1rem !important;
          line-height: 1.6 !important;
          color: var(--theme-panel-muted) !important;
        }
        .structured-daily-capture > section {
          width: 100%;
          margin: 0 0 1rem;
          padding: clamp(.9rem, 3vw, 1.25rem);
          border: 1px solid var(--theme-panel-border);
          border-radius: 16px;
          background: var(--theme-panel-bg);
          box-shadow: 0 2px 10px rgba(23, 43, 53, .035);
        }
        .structured-daily-capture > section > h2 {
          margin: 0 0 .85rem !important;
          font-size: 1.2rem !important;
          line-height: 1.3 !important;
          letter-spacing: -.015em;
        }
        .structured-daily-capture section > div[style*="background"] {
          max-width: 100%;
          overflow-wrap: anywhere;
        }
        .structured-daily-capture form {
          width: 100%;
          min-width: 0;
        }
        .structured-daily-capture form > div,
        .structured-daily-capture form label {
          min-width: 0;
          max-width: 100%;
          overflow-wrap: anywhere;
        }
        .structured-daily-capture input:not([type="checkbox"]):not([type="radio"]),
        .structured-daily-capture select,
        .structured-daily-capture textarea {
          display: block;
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          min-height: 46px;
          padding: .7rem .8rem !important;
          border: 1px solid var(--theme-panel-border) !important;
          border-radius: 9px !important;
          background: var(--theme-field-bg) !important;
          color: var(--theme-field-fg) !important;
          font-family: inherit;
          font-size: 16px !important;
          line-height: 1.45;
          white-space: normal;
        }
        .structured-daily-capture textarea {
          min-height: 7rem;
          resize: vertical;
          overflow-wrap: anywhere;
        }
        .structured-daily-capture input:focus,
        .structured-daily-capture select:focus,
        .structured-daily-capture textarea:focus {
          border-color: var(--theme-link) !important;
          outline: 3px solid color-mix(in srgb, var(--theme-link) 18%, transparent);
          outline-offset: 1px;
        }
        .structured-daily-capture button {
          min-height: 44px;
          max-width: 100%;
          white-space: normal !important;
          overflow-wrap: anywhere;
          line-height: 1.35;
        }
        .structured-daily-capture form button,
        .structured-daily-capture section button {
          flex-shrink: 1;
        }
        .structured-daily-capture ul {
          min-width: 0;
          max-width: 100%;
          padding-inline-start: 1.1rem;
        }
        .structured-daily-capture li {
          min-width: 0;
          max-width: 100%;
        }
        .structured-daily-capture [style*="grid-template-columns"] {
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr)) !important;
          min-width: 0 !important;
        }
        .structured-daily-capture [style*="display: flex"] {
          flex-wrap: wrap;
          min-width: 0;
        }
        .structured-daily-capture [style*="justify-content: space-between"] {
          gap: .5rem;
        }
        .structured-daily-capture [style*="borderRadius"] {
          overflow-wrap: anywhere;
        }
        .structured-daily-capture img,
        .structured-daily-capture video,
        .structured-daily-capture canvas {
          max-width: 100%;
          height: auto;
        }
        .daily-care-error {
          width: 100%;
          max-width: 38rem;
          margin-inline: auto;
          overflow-wrap: anywhere;
        }
        .daily-care-follow-up-list {
          display: grid;
          gap: .55rem;
          margin: .75rem 0 0;
          padding: 0;
          list-style: none;
        }
        .daily-care-follow-up-item {
          display: grid;
          gap: .35rem;
          min-width: 0;
          padding: .8rem .9rem;
          border: 1px solid var(--theme-panel-border);
          border-radius: 12px;
          background: var(--theme-panel-bg);
          color: var(--theme-panel-fg);
          overflow-wrap: anywhere;
        }
        .daily-care-follow-up-item strong {
          color: var(--theme-panel-fg);
          font-size: .95rem;
          line-height: 1.4;
        }
        .daily-care-follow-up-item p,
        .daily-care-follow-up-meta,
        .daily-care-follow-up-empty {
          margin: 0;
          color: var(--theme-panel-muted);
          font-size: .85rem;
          line-height: 1.45;
        }
        .daily-care-follow-up-meta {
          display: flex;
          flex-wrap: wrap;
          gap: .5rem .9rem;
        }
        @media (max-width: 600px) {
          .daily-care-screen { padding: .75rem; }
          .daily-care-page-head { gap: .35rem; }
          .daily-care-page-head > :first-child { flex: 0 0 auto; }
          .structured-daily-capture > section {
            margin-bottom: .8rem;
            border-radius: 13px;
          }
          .structured-daily-capture [style*="grid-template-columns"] {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .structured-daily-capture [style*="display: flex"] {
            gap: .6rem;
          }
          .structured-daily-capture button {
            max-width: 100%;
          }
        }
        @media (max-width: 360px) {
          .daily-care-screen { padding: .55rem; }
          .structured-daily-capture > section { padding: .75rem; }
          .structured-daily-capture > section > h2 { font-size: 1.1rem !important; }
        }
      `}</style>
    </div>
  );
}
