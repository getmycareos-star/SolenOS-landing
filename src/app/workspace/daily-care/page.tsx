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
import DailyCarePhotoCapture from "@/components/workflows/DailyCarePhotoCapture";
import CaptureAnalysisReview from "@/components/workflows/CaptureAnalysisReview";
import { caregiverInformationLabel, caregiverSafeAssistantText, caregiverStatusLabel } from "@/lib/caregiver-language";

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
    "Reconciliation review",
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
    return caregiverSafeAssistantText(item.source_label) || "Saved care record";
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
  return "Source not recorded";
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
      item.original_text ? `Earlier entry: ${caregiverSafeAssistantText(item.original_text) || "An earlier entry was saved."}` : "",
      item.corrected_text ? `Correction: ${caregiverSafeAssistantText(item.corrected_text) || "A correction was saved."}` : "",
      item.reason ? `Reason: ${caregiverSafeAssistantText(item.reason) || "A reason was recorded."}` : "",
    ].filter(Boolean).join(" · ");
  }

  const raw = item.text || item.description || "";
  if (!raw) return caregiverSafeAssistantText(item.reason) || "";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return caregiverSafeAssistantText(raw) || "Saved care information";
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
      ? caregiverSafeAssistantText(quick.note.trim()) || ""
      : typeof capture.notes === "string" && capture.notes.trim()
        ? caregiverSafeAssistantText(capture.notes.trim()) || ""
        : typeof capture.original_notes === "string" && capture.original_notes.trim()
          ? caregiverSafeAssistantText(capture.original_notes.trim()) || ""
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
        parts.push(`${caregiverSafeAssistantText(name) || "Medicine"}: ${statusLabels[status] || caregiverStatusLabel(status) || "Status not recorded"}${scheduledFor}`);
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
          parts.push(`${caregiverSafeAssistantText(type) || "Measurement"}: ${reading}${unit ? ` ${unit}` : ""}`);
        }
      }
    }

    return parts.length ? parts.join(" · ") : "Saved care information";
  } catch {
    return caregiverSafeAssistantText(raw) || "Saved care information";
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
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode | null>(null);
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

  useEffect(() => {
    let active = true;
    setContextLoading(true);
    setContextError("");
    void ensureAnonymousSession()
      .then(async () => {
        // Do not make caregivers wait for current-care and history reads before
        // they can record an update. The capture interface is useful as soon
        // as the anonymous session is ready; context can finish loading below.
        if (active) setReady(true);
        const [careResult, historyResult, followUpsResult, notificationsResult, documentsResult] = await Promise.allSettled([
          getJSON("/care-continuity/current-care?limit_per_source=20"),
          getJSON("/daily-care/intelligence/history?limit=200&offset=0"),
          getJSON("/open-loops?limit=100&offset=0"),
          getJSON("/notifications?limit=100&offset=0"),
          getJSON("/documents/status?limit=10"),
        ]);
        if (!active) return;

        if (careResult.status === "fulfilled") {
          const payload = careResult.value as { items?: unknown };
          setCareItems(Array.isArray(payload?.items) ? payload.items as CareItem[] : []);
        } else {
          setContextError("Current care information could not be loaded. Try refreshing the record.");
        }

        if (followUpsResult.status === "fulfilled") {
          const payload = followUpsResult.value as { items?: unknown };
          if (Array.isArray(payload?.items)) {
            const items = payload.items as DailyCareFollowUp[];
            setFollowUps(items.filter((item) => !["closed", "cancelled"].includes(item.status)));
            setFollowUpsError("");
          } else {
            setFollowUpsError("The saved follow-up list could not be read. Check it before assuming nothing is outstanding.");
          }
        } else {
          setFollowUpsError("Existing follow-ups could not be loaded. Check them before assuming nothing is outstanding.");
        }

        if (documentsResult.status === "fulfilled") {
          const payload = documentsResult.value as { items?: unknown };
          if (Array.isArray(payload?.items)) {
            setDocuments(payload.items as DailyCareDocumentStatus[]);
            setDocumentsError("");
          } else {
            setDocumentsError("Document processing status could not be read. Check the document library before assuming processing is complete.");
          }
        } else {
          setDocumentsError("Document processing status could not be checked. Check the document library before assuming processing is complete.");
        }

        if (notificationsResult.status === "fulfilled") {
          const payload = notificationsResult.value as {
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
              title: caregiverSafeAssistantText(item.title) || "Care notification",
              message: caregiverSafeAssistantText(item.push_delivery?.message) || "This notification could not be sent to this device. It remains in your SolenOS inbox.",
            })));
            setDeliveryStatusError("");
          } else {
            setDeliveryStatusError("Notification delivery status could not be read just now.");
          }
        } else {
          setDeliveryStatusError("Notification delivery status could not be checked just now.");
        }

        if (historyResult.status === "fulfilled") {
          const payload = historyResult.value as {
            records?: unknown;
            page?: { has_more?: boolean };
          };
          if (!Array.isArray(payload?.records)) {
            setHistoryError("Recent care history could not be read. The daily summary is unavailable.");
            setHistoryItems([]);
            setHistoryMayBeTruncated(false);
          } else {
            const records = payload.records as CareItem[];
            setHistoryError("");
            setHistoryItems(records);
            setHistoryMayBeTruncated(Boolean(payload.page?.has_more));

          const personId = getPersonId();
          const caregiverId = getCaregiverId();
          if (personId && caregiverId && careResult.status === "fulfilled") {
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
          } else {
            setSinceLastOpenItems(null);
            setLastOpenedAt(null);
          }
          }
        } else {
          setHistoryError("Recent care history could not be loaded. The daily summary is unavailable.");
        }
        setReady(true);
        setContextLoading(false);
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
          variant="icon"
          aria-label="Back to care record"
          onClick={() => router.push("/workspace")}
        >
          <ArrowLeft size={20} aria-hidden />
        </Button>
        <div>
          <p className="daily-care-eyebrow"><CalendarDays size={15} aria-hidden /> DAILY CARE</p>
          <h1>Your care journey, remembered.</h1>
          <p>See what has been recorded. Add something only when it would help.</p>
        </div>
      </div>

      {error ? (
        <section className="daily-care-error" role="alert">
          <h2>Daily Care could not be opened</h2>
          <p>{error}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>Try again</Button>
        </section>
      ) : ready ? (
        <>
          <section aria-labelledby="daily-care-current-title" className="daily-care-context-panel">
            <h2 id="daily-care-current-title">Where things stand</h2>
            <p className="daily-care-muted">The latest information currently available in the care record.</p>
            {contextLoading ? (
              <p>Loading care information…</p>
            ) : careItems.filter((item) => !isOpenMatter(item)).length > 0 ? (
              <ul className="daily-care-record-list">
                {careItems.filter((item) => !isOpenMatter(item)).slice(0, 5).map((item, index) => (
                  <li key={item.id || `care-item-${index}`}>
                    <strong>{caregiverSafeAssistantText(item.title) || "Care update"}</strong>
                    {displayHistoryText(item) && <p>{displayHistoryText(item)}</p>}
                    {item.capture_processing?.message && (
                      <p className="daily-care-muted">{item.capture_processing.message}</p>
                    )}
                    <span>{displayHistoryTime(item)}</span>
                    <span> · {displayHistorySource(item)}</span>
                    {caregiverInformationLabel(item.epistemic_status) && <span> · {caregiverInformationLabel(item.epistemic_status)}</span>}
                    {caregiverStatusLabel(item.status) && <span> · {caregiverStatusLabel(item.status)}</span>}
                    {item.capture_processing?.review_required && item.capture_processing.analysis_id && (
                      <div style={{ marginTop: 8 }}>
                        <Button
                          variant="secondary"
                          onClick={() => setReviewAnalysisId(item.capture_processing?.analysis_id || null)}
                        >
                          Review suggested details
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No current care updates are available to show. This does not mean nothing happened.</p>
            )}
            {contextError && <p role="status" className="daily-care-muted">{contextError}</p>}
          </section>

          <section aria-labelledby="daily-care-documents-title" className="daily-care-context-panel">
            <h2 id="daily-care-documents-title">Recent documents</h2>
            <p className="daily-care-muted">SolenOS keeps the original files and reports what actually happened during processing.</p>
            {documentsError ? (
              <p role="alert">{documentsError}</p>
            ) : documents.length ? (
              <ul className="daily-care-record-list">
                {documents.slice(0, 5).map((item) => {
                  const statusText: Record<string, string> = {
                    uploaded: "Uploaded. Processing has not started yet.",
                    queued: "SolenOS is processing this document. You do not need to stay on this screen.",
                    processing: "SolenOS is processing this document. You do not need to stay on this screen.",
                    processed: "Readable pages have been processed. Review status is shown below.",
                    partially_processed: "Some pages or processing steps remain incomplete.",
                    retry_required: "Document understanding could not be completed after automatic retries. The original document is still stored.",
                    review_required: "Processing finished, but some information needs review before it can be added to the care record.",
                    failed: "Processing could not be completed. The original document is still stored.",
                    cancelled: "Document processing was stopped.",
                  };
                  const unreadable = item.unreadable_page_numbers || [];
                  const unprocessed = item.unprocessed_page_numbers || [];
                  const processed = item.processed_page_numbers || [];
                  return (
                    <li key={item.evidence_id}>
                      <strong>{caregiverSafeAssistantText(item.document_name) || "Uploaded document"}</strong>
                      <p>{statusText[item.processing_status] || "Processing status is available in the document library."}</p>
                      {typeof item.page_count === "number" && <span>{typeof item.processed_page_count === "number" ? item.processed_page_count : processed.length} of {item.page_count} readable pages processed</span>}
                      {item.retry_scheduled && <p>SolenOS is retrying pages that did not finish. You do not need to stay on this screen.</p>}
                      {(item.retry_exhausted_page_numbers || []).length > 0 && <p>SolenOS retried page{item.retry_exhausted_page_numbers!.length === 1 ? "" : "s"} {item.retry_exhausted_page_numbers!.join(", ")} but could not process them. The original is preserved and the document is still marked incomplete.</p>}
                      {unreadable.length > 0 && <p>Page{unreadable.length === 1 ? "" : "s"} {unreadable.join(", ")} could not be read reliably. SolenOS has not treated missing text as proof that those pages contain nothing important.</p>}
                      {unprocessed.length > 0 && <p>Page{unprocessed.length === 1 ? "" : "s"} {unprocessed.join(", ")} still need processing.</p>}
                      {item.medication_conflict && <p role="status">The document appears to differ from the current medication record. The instruction is unconfirmed. Confirm the current instruction with the prescribing professional or pharmacist before acting on it.</p>}
                      {item.medication_report_saved && <p>Medication information was saved as an unconfirmed report. The existing medication record was not changed.</p>}
                      {item.written_to_lcr && !item.medication_report_saved && <span> · Reviewed information saved to the Living Care Record</span>}
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
          </section>

          <section aria-labelledby="daily-care-follow-ups-title" className="daily-care-context-panel">
            <h2 id="daily-care-follow-ups-title">Existing follow-ups</h2>
            <p className="daily-care-muted">Open follow-ups stay in their existing record. Daily Care does not create a second copy.</p>
            {followUpsError ? (
              <p role="alert">{followUpsError}</p>
            ) : followUps.length ? (
              <ul className="daily-care-record-list">
                {followUps.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <strong>{caregiverSafeAssistantText(item.title) || "Care follow-up"}</strong>
                    {item.description && <p>{caregiverSafeAssistantText(item.description)}</p>}
                    <span>{caregiverStatusLabel(item.status) || "Unresolved"}</span>
                    {item.deadline_at && <span> · Due {displayCareTime(item.deadline_at)}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No unresolved follow-ups are currently recorded. This does not confirm that no action is outstanding.</p>
            )}
            {deliveryIssues.length > 0 && (
              <div role="status" className="daily-care-medication-confirmation">
                <strong>Notification delivery needs attention</strong>
                {deliveryIssues.slice(0, 3).map((issue) => (
                  <p key={issue.id}>{issue.title}: {issue.message}</p>
                ))}
              </div>
            )}
            {deliveryStatusError && <p role="status">{deliveryStatusError}</p>}
            <Button variant="secondary" onClick={() => router.push("/workspace/open-loops")}>View follow-ups</Button>
          </section>

          <section aria-labelledby="daily-care-open-matters-title" className="daily-care-context-panel">
            <h2 id="daily-care-open-matters-title">Open matters</h2>
            <p className="daily-care-muted">Questions, missing information and disagreements that have not been marked as resolved.</p>
            {careItems.filter(isOpenMatter).length > 0 ? (
              <ul className="daily-care-record-list">
                {careItems.filter(isOpenMatter).slice(0, 8).map((item, index) => (
                  <li key={item.id || `open-matter-${index}`}>
                    <strong>{caregiverSafeAssistantText(item.title) || "Open care question"}</strong>
                    {displayHistoryText(item) && <p>{displayHistoryText(item)}</p>}
                    <span>{displayHistoryTime(item)}</span>
                    {item.source_label && <span> · {caregiverSafeAssistantText(item.source_label) || "Saved care record"}</span>}
                    {caregiverInformationLabel(item.epistemic_status) && <span> · {caregiverInformationLabel(item.epistemic_status)}</span>}
                    {caregiverStatusLabel(item.status) && <span> · {caregiverStatusLabel(item.status)}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No open matters are currently recorded in this view. This does not confirm that none exist.</p>
            )}
          </section>

          <section aria-labelledby="daily-care-since-last-title" className="daily-care-context-panel">
            <h2 id="daily-care-since-last-title">Since you last opened Daily Care</h2>
            <p className="daily-care-muted">
              This summary uses records added since your previous visit on this device. It does not describe unrecorded care.
            </p>
            {sinceLastOpenItems === null ? (
              <p>This is the first visit on this device. New recorded updates will appear here the next time you open Daily Care.</p>
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
            ) : (
              <p>No new care records have been added since your last visit on this device. This does not mean nothing happened.</p>
            )}
            {historyMayBeTruncated && <p className="daily-care-muted">The summary is based on the latest 200 history records. Open full history to check older entries.</p>}
          </section>

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
              <p role="alert">{historyError}</p>
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
                      { value: "photo", label: "Photograph", detail: "Add a photo as care-record evidence." },
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
                      <Button variant="secondary" onClick={() => setCaptureMode(null)}>Back to choices</Button>
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

          <section aria-labelledby="daily-care-history-title" className="daily-care-context-panel">
            <div className="daily-care-history-heading">
              <div>
                <h2 id="daily-care-history-title">Recent care history</h2>
                <p className="daily-care-muted">Recorded events, in time order. Missing days do not mean nothing happened.</p>
              </div>
              <Link href="/workspace/timeline" className="care-reminders-inline-link">View all history</Link>
            </div>
            {historyItems.length > 0 ? (
              <ul className="daily-care-record-list">
                {[...new Map(
                  [...historyItems.slice(0, 8), ...(sinceLastOpenItems || [])]
                    .map((item, index) => [historyRecordId(item) || `history-item-${index}`, item] as const)
                ).values()].map((item, index) => (
                  <li
                    id={historyRecordId(item) ? `daily-care-event-${historyRecordId(item)}` : undefined}
                    key={historyRecordId(item) || `history-item-${index}`}
                  >
                    <strong>{item.title || "Care record entry"}</strong>
                    {displayHistoryText(item) && <p>{displayHistoryText(item)}</p>}
                    {item.capture_processing?.message && (
                      <p className="daily-care-muted">{item.capture_processing.message}</p>
                    )}
                    <span>{displayHistoryTime(item)}</span>
                    {item.source_label && <span> · {item.source_label}</span>}
                    {caregiverInformationLabel(item.epistemic_status) && <span> · {caregiverInformationLabel(item.epistemic_status)}</span>}
                    {caregiverStatusLabel(item.status) && <span> · {caregiverStatusLabel(item.status)}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No recent care entries are available. No record is not proof that no care took place.</p>
            )}
          </section>
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
          border-color: #267c78 !important;
          outline: 3px solid rgba(38, 124, 120, .18);
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
